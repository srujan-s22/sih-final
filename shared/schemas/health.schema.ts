import { z } from "zod";

export const HealthCheckResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "unhealthy"]),
  app: z.string(),
  version: z.string(),
  environment: z.string(),
  timestamp: z.string().datetime(),
  correlation_id: z.string().optional(),
  services: z.record(z.string(), z.string()),
});

export type HealthCheckResponseDto = z.infer<typeof HealthCheckResponseSchema>;
