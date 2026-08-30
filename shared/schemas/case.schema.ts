import { z } from "zod";

export const CaseStatusSchema = z.enum([
  "NEW",
  "ACTIVE",
  "REQUESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "NEEDS_ATTENTION",
  "FOLLOW_UP",
  "FOLLOW_UP_REQUIRED",
  "BLOCKED",
  "ESCALATED",
  "RESOLVED",
  "CITIZEN_DECLINED",
  "CLOSED",
]);

export const CasePrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

export const CaseTaskStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "BLOCKED",
]);

export const UpdateCaseInputSchema = z.object({
  status: CaseStatusSchema.optional(),
  priority: CasePrioritySchema.optional(),
  schemeId: z.string().optional().nullable(),
  schemeName: z.string().optional().nullable(),
  beneficiaryMemberId: z.string().optional().nullable(),
  beneficiaryName: z.string().optional().nullable(),
  currentJourneyStep: z.string().optional().nullable(),
  lastContactAt: z.string().datetime().optional().nullable(),
});

export const CreateCaseTaskInputSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200).trim(),
  description: z.string().min(1, "Task description is required").max(1000).trim(),
  type: z.string().min(1).default("GENERAL"),
  status: CaseTaskStatusSchema.optional().default("PENDING"),
  schemeId: z.string().optional().nullable(),
  beneficiaryMemberId: z.string().optional().nullable(),
  beneficiaryName: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const UpdateCaseTaskInputSchema = z.object({
  status: CaseTaskStatusSchema.optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const CompleteCaseTaskInputSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
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
  beneficiaryMemberId: z.string().optional().nullable(),
  beneficiaryName: z.string().optional().nullable(),
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

export const InitiateSchemeAssistanceInputSchema = z.object({
  schemeId: z.string().min(1, "Scheme ID is required").trim(),
  beneficiaryMemberId: z.string().optional().nullable(),
  priority: CasePrioritySchema.optional().default("NORMAL"),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateCaseInput = z.infer<typeof UpdateCaseInputSchema>;
export type CreateCaseTaskInput = z.input<typeof CreateCaseTaskInputSchema>;
export type UpdateCaseTaskInput = z.infer<typeof UpdateCaseTaskInputSchema>;
export type CompleteCaseTaskInput = z.infer<typeof CompleteCaseTaskInputSchema>;
export type CreateCaseNoteInput = z.infer<typeof CreateCaseNoteInputSchema>;
export type CreateCaseFollowUpInput = z.infer<typeof CreateCaseFollowUpInputSchema>;
export type UpdateCaseFollowUpInput = z.infer<typeof UpdateCaseFollowUpInputSchema>;
export type AssignCaseInput = z.infer<typeof AssignCaseInputSchema>;
export type InitiateSchemeAssistanceInput = z.infer<typeof InitiateSchemeAssistanceInputSchema>;

