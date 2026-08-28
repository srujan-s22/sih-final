import { z } from "zod";

export const UserRoleSchema = z.enum(["CITIZEN", "ASHA", "ADMIN"]);

export const ConsentStatusSchema = z.enum(["accepted", "pending", "declined"]);

export const ConsentSubmissionSchema = z.object({
  consentVersion: z.string().min(1, "Consent version is required"),
  accepted: z.boolean(),
  method: z.enum(["web_portal", "mobile"]).optional().default("web_portal"),
});

export const RoleAssignmentSchema = z.object({
  targetUid: z.string().min(1, "Target user ID is required"),
  newRole: UserRoleSchema,
});

export const RolePrevalidateSchema = z.object({
  requestedRole: UserRoleSchema,
  registrationSecret: z.string().max(256).optional().nullable(),
});

export const UserSyncSchema = z.object({
  displayName: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  requestedRole: UserRoleSchema.optional().nullable(),
  registrationSecret: z.string().max(256).optional().nullable(),
});

export const UserRegisterSchema = z.object({
  displayName: z.string().max(100).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  requestedRole: UserRoleSchema.optional().nullable(),
  registrationSecret: z.string().max(256).optional().nullable(),
});

export type ConsentSubmissionInput = z.infer<typeof ConsentSubmissionSchema>;
export type RoleAssignmentInput = z.infer<typeof RoleAssignmentSchema>;
export type RolePrevalidateInput = z.infer<typeof RolePrevalidateSchema>;
export type UserSyncInput = z.infer<typeof UserSyncSchema>;
export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
