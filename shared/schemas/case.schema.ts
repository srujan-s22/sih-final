import { z } from "zod";

export const CaseStatusSchema = z.enum([
  "NEW",
  "ACTIVE",
  "NEEDS_ATTENTION",
  "FOLLOW_UP",
  "RESOLVED",
  "CLOSED",
]);

export const CasePrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

export const UpdateCaseInputSchema = z.object({
  status: CaseStatusSchema.optional(),
  priority: CasePrioritySchema.optional(),
  lastContactAt: z.string().datetime().optional().nullable(),
});

export const CreateCaseNoteInputSchema = z.object({
  content: z
    .string()
    .min(1, "Note content cannot be empty")
    .max(2000, "Note cannot exceed 2,000 characters")
    .trim(),
});

export const CreateCaseFollowUpInputSchema = z.object({
  scheduledAt: z.string().min(1, "Scheduled date/time is required"),
  reason: z
    .string()
    .min(1, "Follow-up reason cannot be empty")
    .max(500, "Follow-up reason cannot exceed 500 characters")
    .trim(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateCaseFollowUpInputSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  notes: z.string().max(1000).optional().nullable(),
});

export const AssignCaseInputSchema = z.object({
  householdId: z.string().min(1, "Household ID is required").trim(),
  ashaUid: z.string().min(1, "ASHA UID is required").trim(),
});

export type UpdateCaseInput = z.infer<typeof UpdateCaseInputSchema>;
export type CreateCaseNoteInput = z.infer<typeof CreateCaseNoteInputSchema>;
export type CreateCaseFollowUpInput = z.infer<typeof CreateCaseFollowUpInputSchema>;
export type UpdateCaseFollowUpInput = z.infer<typeof UpdateCaseFollowUpInputSchema>;
export type AssignCaseInput = z.infer<typeof AssignCaseInputSchema>;
