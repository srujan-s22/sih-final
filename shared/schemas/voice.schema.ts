import { z } from "zod";

/**
 * Conversational Turn Input Validation Schema
 */
export const VoiceTurnInputSchema = z.object({
  transcript: z.string().optional(),
  audioBase64: z.string().optional(),
  audioFormat: z.string().optional(),
  languageCode: z.string().optional(),
  verificationCode: z.string().optional(),
});

export type VoiceTurnInput = z.infer<typeof VoiceTurnInputSchema>;

/**
 * Caller Identity Verification Schema
 */
export const VerifyCallerIdentityInputSchema = z.object({
  verificationCode: z.string().min(2).max(12),
});

export type VerifyCallerIdentityInput = z.infer<typeof VerifyCallerIdentityInputSchema>;

/**
 * Outbound Call Dispatch Schema
 * Note: Never accepts an arbitrary phone number from the client!
 * The destination phone number is resolved server-side from the followUpId.
 */
export const InitiateOutboundCallInputSchema = z.object({
  followUpId: z.string().min(1, "followUpId is required"),
  caseId: z.string().optional(),
  reason: z.string().optional(),
});

export type InitiateOutboundCallInput = z.infer<typeof InitiateOutboundCallInputSchema>;

/**
 * Exotel Inbound Webhook Payload Schema
 */
export const ExotelInboundWebhookSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  CallerNumber: z.string().optional(),
  Digits: z.string().optional(),
  RecordingUrl: z.string().optional(),
  CustomField: z.string().optional(),
});

export type ExotelInboundWebhook = z.infer<typeof ExotelInboundWebhookSchema>;

/**
 * Exotel Status Callback Payload Schema
 */
export const ExotelStatusCallbackSchema = z.object({
  CallSid: z.string().min(1),
  Status: z.string().min(1),
  Duration: z.union([z.string(), z.number()]).optional(),
  RecordingUrl: z.string().optional(),
  StartTime: z.string().optional(),
  EndTime: z.string().optional(),
  CustomField: z.string().optional(),
});

export type ExotelStatusCallback = z.infer<typeof ExotelStatusCallbackSchema>;
