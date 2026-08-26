"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckResponseSchema = void 0;
const zod_1 = require("zod");
exports.HealthCheckResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(["ok", "degraded", "unhealthy"]),
    app: zod_1.z.string(),
    version: zod_1.z.string(),
    environment: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    correlation_id: zod_1.z.string().optional(),
    services: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
