import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import * as admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import fs from "fs";

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

const firebasePlugin: FastifyPluginAsync = async (fastify) => {
  let app: admin.app.App | null = null;
  let firestoreInstance: Firestore | null = null;
  let initMethod = "uninitialized";
  let initError: string | null = null;

  if (!admin.apps.length) {
    try {
      // 1. Raw JSON string from secret manager / env
      if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const cert = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
        app = admin.initializeApp({
          credential: admin.credential.cert(cert),
          projectId: env.FIREBASE_PROJECT_ID || cert.project_id,
        });
        initMethod = "service_account_json_env";
        fastify.log.info("Initialized Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON.");
      }
      // 2. Local filepath to service account JSON
      else if (env.FIREBASE_CREDENTIALS_PATH && fs.existsSync(env.FIREBASE_CREDENTIALS_PATH)) {
        const cert = JSON.parse(fs.readFileSync(env.FIREBASE_CREDENTIALS_PATH, "utf-8"));
        app = admin.initializeApp({
          credential: admin.credential.cert(cert),
          projectId: env.FIREBASE_PROJECT_ID || cert.project_id,
        });
        initMethod = "service_account_file";
        fastify.log.info(`Initialized Firebase Admin from file: ${env.FIREBASE_CREDENTIALS_PATH}`);
      }
      // 3. Explicit project ID + client email + private key
      else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
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
      // 4. Project ID fallback (Local development / Emulator / ADC)
      else if (env.FIREBASE_PROJECT_ID) {
        app = admin.initializeApp({
          projectId: env.FIREBASE_PROJECT_ID,
        });
        initMethod = "project_id_only";
        fastify.log.info(`Initialized Firebase Admin with project ID: ${env.FIREBASE_PROJECT_ID}`);
      } else {
        fastify.log.info("Firebase Admin running in unconfigured local foundation mode for Phase 1.");
        initMethod = "unconfigured_foundation";
      }

      if (app) {
        try {
          firestoreInstance = getFirestore(app);
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
    initMethod = "existing_instance";
  }

  const firebaseStatus = {
    initialized: Boolean(app),
    method: initMethod,
    projectId: env.FIREBASE_PROJECT_ID || null,
    error: initError,
  };

  fastify.decorate("firebaseApp", app);
  fastify.decorate("firestore", firestoreInstance);
  fastify.decorate("firebaseStatus", firebaseStatus);
};

export default fp(firebasePlugin, {
  name: "firebase-plugin",
});
