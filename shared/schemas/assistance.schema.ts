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
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const CreateAssistanceRequestSchema = z.object({
  category: AssistanceCategoryEnum,
  schemeId: z.string().optional(),
  schemeName: z.string().optional(),
  message: z
    .string()
    .min(3, "Message must be at least 3 characters")
    .max(1000, "Message cannot exceed 1000 characters"),
});

export const UpdateAssistanceRequestSchema = z.object({
  status: AssistanceStatusEnum,
  responseNote: z.string().max(1000).optional(),
});
