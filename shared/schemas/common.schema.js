"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiErrorResponseSchema = exports.ErrorDetailSchema = void 0;
const zod_1 = require("zod");
exports.ErrorDetailSchema = zod_1.z.object({
    field: zod_1.z.string().optional(),
    message: zod_1.z.string(),
    type: zod_1.z.string().optional(),
});
exports.ApiErrorResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(false),
    error: zod_1.z.string(),
    message: zod_1.z.string(),
    code: zod_1.z.string(),
    correlation_id: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().datetime(),
    details: zod_1.z.array(exports.ErrorDetailSchema).optional(),
});
