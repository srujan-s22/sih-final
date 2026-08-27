import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import * as admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import os from "os";

declare module "fastify" {
  interface FastifyInstance {
    firebaseApp: admin.app.App | null;
    firestore: Firestore | null;
    firebaseStatus: {
      initialized: boolean;
      method: string;
      projectId: string | null;
      error: string | null;
    };
  }
}

function resolveFilePath(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return path.join(os.homedir(), filePath.slice(1));
  }
  if (filePath.startsWith("$HOME/")) {
    return path.join(os.homedir(), filePath.slice(6));
  }
  return path.resolve(filePath);
}

const firebasePlugin: FastifyPluginAsync = async (fastify) => {
  let app: admin.app.App | null = null;
  let firestoreInstance: Firestore | null = null;
  let initMethod = "uninitialized";
  let initError: string | null = null;
  let detectedProjectId: string | null = env.FIREBASE_PROJECT_ID || null;

  if (!admin.apps.length) {
    try {
      // 1. Raw JSON string from secret manager / env
      if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const cert = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
        detectedProjectId = cert.project_id || env.FIREBASE_PROJECT_ID;
        app = admin.initializeApp({
          credential: admin.credential.cert(cert),
          projectId: detectedProjectId || undefined,
        });
        initMethod = "service_account_json_env";
        fastify.log.info("Initialized Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON.");
      }
      // 2. Explicit filepath from GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_PATH
      else if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const rawPath = env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS!;
        const resolvedPath = resolveFilePath(rawPath);
        if (fs.existsSync(resolvedPath)) {
          const cert = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
          detectedProjectId = cert.project_id || env.FIREBASE_PROJECT_ID;
          app = admin.initializeApp({
            credential: admin.credential.cert(cert),
            projectId: detectedProjectId || undefined,
          });
          initMethod = "service_account_file";
          fastify.log.info(`Initialized Firebase Admin from file: ${resolvedPath}`);
        } else {
          fastify.log.warn(`Service account file not found at: ${resolvedPath}`);
        }
      }
      
      // 3. Default secure user config directory fallback (~/.config/swasthyaSetu/firebase-service-account.json)
      if (!app) {
        const defaultSecurePath = path.join(os.homedir(), ".config", "swasthyaSetu", "firebase-service-account.json");
        if (fs.existsSync(defaultSecurePath)) {
          const cert = JSON.parse(fs.readFileSync(defaultSecurePath, "utf-8"));
          detectedProjectId = cert.project_id || env.FIREBASE_PROJECT_ID;
          app = admin.initializeApp({
            credential: admin.credential.cert(cert),
            projectId: detectedProjectId || undefined,
          });
          initMethod = "default_user_config_file";
          fastify.log.info(`Initialized Firebase Admin from secure config: ${defaultSecurePath}`);
        }
      }

      // 4. Explicit project ID + client email + private key
      if (!app && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
        app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });
        initMethod = "env_credentials";
        fastify.log.info("Initialized Firebase Admin from discrete environment credentials.");
      }

      // 5. Project ID fallback (Local development / Emulator / ADC)
      if (!app && env.FIREBASE_PROJECT_ID) {
        app = admin.initializeApp({
          projectId: env.FIREBASE_PROJECT_ID,
        });
        initMethod = "project_id_only";
        fastify.log.info(`Initialized Firebase Admin with project ID: ${env.FIREBASE_PROJECT_ID}`);
      } else if (!app) {
        fastify.log.info("Firebase Admin running in unconfigured local foundation mode for Phase 1.");
        initMethod = "unconfigured_foundation";
      }

      if (app) {
        try {
          firestoreInstance = getFirestore(app);
          firestoreInstance.settings({ ignoreUndefinedProperties: true });
          fastify.log.info("Cloud Firestore client initialized successfully.");
        } catch (fsErr) {
          fastify.log.warn({ err: fsErr }, "Firestore connection deferred (no active credentials).");
          initError = "Firestore connection deferred";
        }
      }
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      fastify.log.error({ err: e }, "Firebase Admin initialization error");
      initError = errMessage;
      initMethod = "failed";
    }
  } else {
    app = admin.apps[0]!;
    firestoreInstance = getFirestore(app);
    try {
      firestoreInstance.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings already frozen
    }
    initMethod = "existing_instance";
  }

  const firebaseStatus = {
    initialized: Boolean(app),
    method: initMethod,
    projectId: detectedProjectId || env.FIREBASE_PROJECT_ID || null,
    error: initError,
  };

  fastify.decorate("firebaseApp", app);
  fastify.decorate("firestore", firestoreInstance);
  fastify.decorate("firebaseStatus", firebaseStatus);
};

export default fp(firebasePlugin, {
  name: "firebase-plugin",
});
