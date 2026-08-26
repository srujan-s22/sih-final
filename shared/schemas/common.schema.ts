import { z } from "zod";

export const ErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  type: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  code: z.string(),
  correlation_id: z.string().optional(),
  timestamp: z.string().datetime(),
  details: z.array(ErrorDetailSchema).optional(),
});

export type ApiErrorResponseDto = z.infer<typeof ApiErrorResponseSchema>;
