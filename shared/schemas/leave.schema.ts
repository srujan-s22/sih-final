import { z } from "zod";

/**
 * Validates a YYYY-MM-DD calendar date string
 */
const DateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, "Invalid calendar date.");

export const CreateLeaveRequestSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    reason: z
      .string()
      .trim()
      .min(5, "Leave reason must be at least 5 characters.")
      .max(1000, "Leave reason must not exceed 1000 characters."),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start.getTime() <= end.getTime();
    },
    {
      message: "Leave start date cannot be after end date.",
      path: ["startDate"],
    }
  );

export const ApproveLeaveRequestSchema = z.object({
  replacementAshaId: z
    .string()
    .trim()
    .min(1, "A valid replacement ASHA worker must be selected."),
  notes: z
    .string()
    .trim()
    .max(500, "Approval notes must not exceed 500 characters.")
    .optional(),
});

export const RejectLeaveRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Rejection reason must be at least 3 characters.")
    .max(500, "Rejection reason must not exceed 500 characters."),
});

export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestSchema>;
export type ApproveLeaveRequestInput = z.infer<typeof ApproveLeaveRequestSchema>;
export type RejectLeaveRequestInput = z.infer<typeof RejectLeaveRequestSchema>;
