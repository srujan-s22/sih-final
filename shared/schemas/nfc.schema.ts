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
});

export type NfcProvisionParamsInput = z.infer<typeof NfcProvisionParamsSchema>;
export type NfcRevokeInput = z.infer<typeof NfcRevokeSchema>;
export type NfcResolveInput = z.infer<typeof NfcResolveSchema>;
