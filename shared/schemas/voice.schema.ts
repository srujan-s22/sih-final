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
 * Citizen Inbound/Assistant Request Schema
 */
export const CitizenCallRequestSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^(\+91|91)?[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number")
    .optional(),
  language: z.string().optional(),
  reason: z.string().max(200).optional(),
});

export type CitizenCallRequestInput = z.infer<typeof CitizenCallRequestSchema>;

/**
 * ASHA Direct Call Citizen Request Schema
 */
export const AshaCallRequestSchema = z.object({
  caseId: z.string().min(1, "caseId is required"),
  followUpId: z.string().optional(),
  reason: z.string().max(200).optional(),
  language: z.string().optional(),
});

export type AshaCallRequestInput = z.infer<typeof AshaCallRequestSchema>;

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

/**
 * Exotel Stream Inbound Event Schemas
 */
export const ExotelStreamConnectedSchema = z.object({
  event: z.string(),
  protocol: z.string().optional(),
  version: z.string().optional(),
}).passthrough();

export const ExotelStreamStartSchema = z.object({
  event: z.string(),
  sequenceNumber: z.union([z.string(), z.number()]).optional(),
  streamSid: z.string().optional(),
  stream_sid: z.string().optional(),
  callSid: z.string().optional(),
  call_sid: z.string().optional(),
  start: z
    .object({
      streamSid: z.string().optional(),
      stream_sid: z.string().optional(),
      accountSid: z.string().optional(),
      account_sid: z.string().optional(),
      callSid: z.string().optional(),
      call_sid: z.string().optional(),
      tracks: z.array(z.string()).optional(),
      mediaFormat: z
        .object({
          encoding: z.string().optional(),
          sampleRate: z.number().optional(),
          sample_rate: z.number().optional(),
          channels: z.number().optional(),
        })
        .optional(),
      customParameters: z.record(z.any()).nullable().optional(),
      custom_parameters: z.record(z.any()).nullable().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

export const ExotelStreamMediaSchema = z.object({
  event: z.string(),
  sequenceNumber: z.union([z.string(), z.number()]).optional(),
  streamSid: z.string().optional(),
  stream_sid: z.string().optional(),
  media: z
    .object({
      track: z.string().optional(),
      chunk: z.union([z.string(), z.number()]).optional(),
      timestamp: z.union([z.string(), z.number()]).optional(),
      payload: z.string().min(1),
    })
    .passthrough(),
}).passthrough();

export const ExotelStreamStopSchema = z.object({
  event: z.string(),
  sequenceNumber: z.union([z.string(), z.number()]).optional(),
  streamSid: z.string().optional(),
  stream_sid: z.string().optional(),
  stop: z
    .object({
      accountSid: z.string().optional(),
      account_sid: z.string().optional(),
      callSid: z.string().optional(),
      call_sid: z.string().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

export const ExotelStreamMarkSchema = z.object({
  event: z.string(),
  sequenceNumber: z.union([z.string(), z.number()]).optional(),
  streamSid: z.string().optional(),
  stream_sid: z.string().optional(),
  mark: z
    .object({
      name: z.string().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

export const ExotelStreamInboundMessageSchema = z.union([
  ExotelStreamConnectedSchema,
  ExotelStreamStartSchema,
  ExotelStreamMediaSchema,
  ExotelStreamStopSchema,
  ExotelStreamMarkSchema,
]);


