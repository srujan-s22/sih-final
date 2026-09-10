import { z } from "zod";

/**
 * Zod schema for NFC route params /:householdId/nfc
 */
export const NfcProvisionParamsSchema = z.object({
  householdId: z
    .string({ required_error: "Household ID is required" })
    .trim()
    .min(3, "Household ID must be at least 3 characters")
    .max(100, "Household ID must be under 100 characters"),
});

/**
 * Zod schema for optional revocation or rotation reason
 */
export const NfcRevokeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "Reason must be at least 2 characters")
    .max(200, "Reason must be under 200 characters")
    .optional(),
});

/**
 * Zod schema for confirming successful physical NFC card write during rotation
 */
export const NfcConfirmRotationSchema = z.object({
  nfcId: z
    .string({ required_error: "NFC ID is required" })
    .trim()
    .min(5, "NFC ID must be at least 5 characters")
    .max(120, "NFC ID must be under 120 characters"),
  version: z
    .number({ required_error: "Credential version is required" })
    .int()
    .positive("Version must be a positive integer"),
  reason: z
    .string()
    .trim()
    .max(200, "Reason must be under 200 characters")
    .optional(),
});

/**
 * Zod schema for cancelling an in-progress rotation attempt
 */
export const NfcCancelRotationSchema = z.object({
  nfcId: z
    .string()
    .trim()
    .min(5, "NFC ID must be at least 5 characters")
    .max(120, "NFC ID must be under 120 characters")
    .optional(),
  reason: z
    .string()
    .trim()
    .max(200, "Reason must be under 200 characters")
    .optional(),
});

/**
 * Zod schema for public NFC resolution
 */
export const NfcResolveSchema = z.object({
  householdId: z
    .string({ required_error: "Household ID is required" })
    .trim()
    .min(3, "Household ID must be at least 3 characters")
    .max(100, "Household ID must be under 100 characters"),
  token: z
    .string({ required_error: "NFC Access Token is required" })
    .trim()
    .min(16, "Access token must be at least 16 characters")
    .max(128, "Access token must be under 128 characters"),
  version: z
    .number()
    .int("Version must be an integer")
    .positive("Version must be a positive integer")
    .max(100000, "Version parameter out of range")
    .optional(),
});

export type NfcProvisionParamsInput = z.infer<typeof NfcProvisionParamsSchema>;
export type NfcRevokeInput = z.infer<typeof NfcRevokeSchema>;
export type NfcConfirmRotationInput = z.infer<typeof NfcConfirmRotationSchema>;
export type NfcCancelRotationInput = z.infer<typeof NfcCancelRotationSchema>;
export type NfcResolveInput = z.infer<typeof NfcResolveSchema>;
