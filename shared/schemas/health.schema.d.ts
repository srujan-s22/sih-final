import { z } from "zod";
export declare const HealthCheckResponseSchema: any;
export type HealthCheckResponseDto = z.infer<typeof HealthCheckResponseSchema>;
