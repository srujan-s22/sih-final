import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { HealthCheckResponse, ApiErrorResponse } from "../../shared/types/api.js";

describe("Fastify Health & API Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health should return 200 with HealthCheckResponse schema", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as HealthCheckResponse;
    expect(body.status).toBe("ok");
    expect(body.app).toBe("SwasthyaSetu API");
    expect(body.version).toBe("1.0.0");
    expect(body.services).toBeDefined();
    expect(body.services.api).toBe("operational");
    expect(response.headers["x-correlation-id"]).toBeDefined();
  });

  it("GET /api/v1/health should return 200", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as HealthCheckResponse;
    expect(body.status).toBe("ok");
  });

  it("Should preserve and propagate incoming X-Correlation-ID header", async () => {
    const customCorrelationId = "test-node-corr-12345";
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        "x-correlation-id": customCorrelationId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe(customCorrelationId);
    const body = JSON.parse(response.payload) as HealthCheckResponse;
    expect(body.correlation_id).toBe(customCorrelationId);
  });

  it("GET /api/nonexistent-route should return 404 with standardized ApiErrorResponse", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/nonexistent-route",
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload) as ApiErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBe("NotFound");
    expect(body.code).toBe("ROUTE_NOT_FOUND");
    expect(body.message).toContain("not found");
    expect(response.headers["x-correlation-id"]).toBeDefined();
  });
});
