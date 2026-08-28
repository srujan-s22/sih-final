import { z } from "zod";

export const AssistantRoleSchema = z.enum(["user", "assistant"]);

export const AssistantMessageSchema = z.object({
  role: AssistantRoleSchema,
  content: z.string().min(1).max(4000),
  timestamp: z.string().optional(),
});

export const AssistantLanguageSchema = z.enum(["en", "hi", "kn"]).default("en");

export const AssistantChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters")
    .trim(),
  conversationHistory: z.array(AssistantMessageSchema).max(10).optional().default([]),
  language: AssistantLanguageSchema.optional().default("en"),
  schemeId: z.string().max(100).optional().nullable(),
  conversationId: z.string().max(100).optional().nullable(),
});

export type AssistantChatRequestInput = z.infer<typeof AssistantChatRequestSchema>;
export type AssistantMessageInput = z.infer<typeof AssistantMessageSchema>;
