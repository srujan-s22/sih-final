import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. server-to-server, curl, tests)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || (env.NODE_ENV === "development" && origin.includes("localhost"))) {
        cb(null, true);
        return;
      }
      cb(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Correlation-ID",
      "X-Request-ID",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["X-Correlation-ID", "X-Request-ID"],
  });
};

export default fp(corsPlugin, {
  name: "cors-plugin",
});
