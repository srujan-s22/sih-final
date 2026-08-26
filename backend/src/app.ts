import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import correlationPlugin from "./plugins/correlation.js";
import corsPlugin from "./plugins/cors.js";
import errorsPlugin from "./plugins/errors.js";
import firebasePlugin from "./plugins/firebase.js";
import authPlugin from "./plugins/auth.js";
import { apiRoutes } from "./routes/index.js";
import { env } from "./config/env.js";

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const isDev = env.NODE_ENV === "development";

  const app = fastify({
    logger: isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        }
      : true,
    ...opts,
  });

  // 1. Core Plugins
  app.register(correlationPlugin);
  app.register(corsPlugin);
  app.register(errorsPlugin);
  app.register(firebasePlugin);
  app.register(authPlugin);

  // 2. API Routes mounted under /api
  app.register(apiRoutes, { prefix: env.API_BASE_PATH });

  return app;
}
