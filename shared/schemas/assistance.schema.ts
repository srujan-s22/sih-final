import { z } from "zod";

export const AssistanceCategoryEnum = z.enum([
  "SCHEME_ENROLLMENT",
  "FACILITY_ACCESS",
  "DOCUMENT_HELP",
  "ELIGIBILITY_CLARIFICATION",
  "FOLLOW_UP",
  "OTHER",
]);

export const AssistanceStatusEnum = z.enum([
  "PENDING",
  "REQUESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "FOLLOW_UP_REQUIRED",
  "BLOCKED",
  "ESCALATED",
  "RESOLVED",
  "DECLINED",
  "CLOSED",
]);

export const AssistancePriorityEnum = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

export const CreateAssistanceRequestSchema = z.object({
  category: AssistanceCategoryEnum,
  schemeId: z.string().optional().nullable(),
  schemeName: z.string().optional().nullable(),
  beneficiaryMemberId: z.string().optional().nullable(),
  message: z
    .string()
    .min(3, "Message must be at least 3 characters")
    .max(1000, "Message cannot exceed 1000 characters"),
  priority: AssistancePriorityEnum.optional().default("NORMAL"),
});

export const UpdateAssistanceRequestSchema = z.object({
  status: AssistanceStatusEnum,
  responseNote: z.string().max(1000).optional().nullable(),
  declineReason: z.string().max(1000).optional().nullable(),
});

