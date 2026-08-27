import { z } from "zod";

export const IncomeCategorySchema = z.enum(["BPL", "AAY", "APL", "OTHER"], {
  errorMap: () => ({ message: "Income category must be one of: BPL, AAY, APL, OTHER" }),
});

export const GenderSchema = z.enum(["male", "female", "other"], {
  errorMap: () => ({ message: "Gender must be male, female, or other" }),
});

export const CreateHouseholdSchema = z.object({
  headOfHouseholdName: z
    .string({ required_error: "Head of household name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be under 100 characters"),
  rationCardNumber: z
    .string({ required_error: "Ration card number is required" })
    .trim()
    .min(4, "Ration card number must be at least 4 characters")
    .max(50, "Ration card number must be under 50 characters"),
  incomeCategory: IncomeCategorySchema,
  state: z
    .string({ required_error: "State is required" })
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(100, "State must be under 100 characters"),
  district: z
    .string({ required_error: "District is required" })
    .trim()
    .min(2, "District must be at least 2 characters")
    .max(100, "District must be under 100 characters"),
  village: z
    .string({ required_error: "Village or city is required" })
    .trim()
    .min(2, "Village or city must be at least 2 characters")
    .max(100, "Village or city must be under 100 characters"),
  pincode: z
    .string({ required_error: "Pincode is required" })
    .trim()
    .regex(/^\d{6}$/, "Pincode must be a valid 6-digit postal code"),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Phone number must be a valid 10-digit number")
    .optional()
    .or(z.literal("")),
});

export const UpdateHouseholdSchema = CreateHouseholdSchema.partial();

export const CreateMemberSchema = z.object({
  fullName: z
    .string({ required_error: "Member full name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be under 100 characters"),
  age: z
    .number({ required_error: "Age is required" })
    .int("Age must be an integer")
    .min(0, "Age must be 0 or greater")
    .max(125, "Age must be realistic"),
  gender: GenderSchema,
  relationship: z
    .string({ required_error: "Relationship to head of household is required" })
    .trim()
    .min(2, "Relationship must be at least 2 characters")
    .max(50, "Relationship must be under 50 characters"),
  disabilityStatus: z.boolean().default(false),
  chronicConditions: z
    .array(z.string().trim().max(100))
    .default([]),
});

export const UpdateMemberSchema = CreateMemberSchema.partial();
