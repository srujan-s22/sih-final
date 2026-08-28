import { z } from "zod";

export const AshaServiceCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^ASHA-[A-Z]{2,3}-[A-Z0-9]{4,6}$/,
    "Invalid ASHA service code format. Expected format like ASHA-KA-7K42."
  );

export const CreateConnectionRequestSchema = z.object({
  serviceCode: AshaServiceCodeSchema,
  notes: z.string().trim().max(500, "Notes must not exceed 500 characters.").optional(),
});

export const ConnectionActionSchema = z.object({
  note: z.string().trim().max(500, "Response note must not exceed 500 characters.").optional(),
});

export type CreateConnectionRequestInput = z.infer<typeof CreateConnectionRequestSchema>;
export type ConnectionActionInput = z.infer<typeof ConnectionActionSchema>;
