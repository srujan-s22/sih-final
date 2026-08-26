import { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { ApiErrorResponse, ErrorDetail } from "../../../shared/types/api.js";
import { HTTP_STATUS } from "../config/constants.js";

const errorsPlugin: FastifyPluginAsync = async (fastify) => {
  // Global 404 Not Found Handler
  fastify.setNotFoundHandler(async (request, reply) => {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: "NotFound",
      message: `The requested endpoint '${request.method} ${request.url}' was not found.`,
      code: "ROUTE_NOT_FOUND",
      correlation_id: request.correlationId,
      timestamp: new Date().toISOString(),
    };
    return reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse);
  });

  // Global Error Handler
  fastify.setErrorHandler((error: FastifyError | Error | unknown, request, reply) => {
    const correlationId = request.correlationId || "no-ctx";
    request.log.error(
      { err: error, correlationId, url: request.url, method: request.method },
      "Request error occurred"
    );

    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
      const details: ErrorDetail[] = error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        type: e.code,
      }));

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: "ValidationError",
        message: "The submitted request data failed schema validation.",
        code: "VALIDATION_FAILED",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        details,
      };

      return reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send(errorResponse);
    }

    const fastifyErr = error as FastifyError;

    // 2. Fastify Validation Errors
    if (fastifyErr.validation && Array.isArray(fastifyErr.validation)) {
      const details: ErrorDetail[] = fastifyErr.validation.map((v: any) => ({
        field: v.instancePath || undefined,
        message: v.message || "Invalid value",
      }));

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: "ValidationError",
        message: fastifyErr.message || "The request parameters failed validation.",
        code: "VALIDATION_FAILED",
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        details,
      };

      return reply.status(HTTP_STATUS.BAD_REQUEST).send(errorResponse);
    }

    // 3. Known HTTP Errors with status code
    const statusCode = fastifyErr.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    if (statusCode < 500) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: fastifyErr.name || `HTTP_${statusCode}`,
        message: fastifyErr.message || "A client error occurred.",
        code: fastifyErr.code || `HTTP_${statusCode}`,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      };
      return reply.status(statusCode).send(errorResponse);
    }

    // 4. Unhandled 500 Internal Server Errors (Sanitized to prevent trace/path leaks)
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: "InternalServerError",
      message: "An unexpected internal server error occurred. Please try again later.",
      code: "INTERNAL_SERVER_ERROR",
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    };

    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(errorResponse);
  });
};

export default fp(errorsPlugin, {
  name: "errors-plugin",
});
