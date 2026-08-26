import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from "../config/constants.js";

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}

const correlationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("correlationId", "");

  fastify.addHook("onRequest", async (request, reply) => {
    const incomingId =
      (request.headers[CORRELATION_ID_HEADER] as string) ||
      (request.headers[REQUEST_ID_HEADER] as string);

    const correlationId =
      incomingId && incomingId.trim().length > 0 && incomingId.length <= 64
        ? incomingId.trim()
        : `req_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;

    request.correlationId = correlationId;
    reply.header(CORRELATION_ID_HEADER, correlationId);
    reply.header(REQUEST_ID_HEADER, correlationId);
  });
};

export default fp(correlationPlugin, {
  name: "correlation-plugin",
});
