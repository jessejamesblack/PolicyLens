import { z } from "zod";
import {
  DOCUMENT_TYPES,
  VALIDATION_STATUSES,
  WARNING_CATEGORIES,
  type DocumentRecord
} from "./types";

export const validationWarningSchema = z.object({
  category: z.enum(WARNING_CATEGORIES),
  field: z.string(),
  message: z.string(),
  severity: z.enum(["warning", "error"])
});

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);

export const structuredLicenseExtractionSchema = z
  .object({
    fullName: z.string().trim().min(1).nullable(),
    licenseNumber: z.string().trim().min(1).nullable(),
    issuingState: z.string().trim().length(2).nullable(),
    dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    issueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    expirationDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    address: z.string().trim().min(1).nullable(),
    licenseClass: z.string().trim().min(1).nullable(),
    endorsements: z.array(z.string().trim().min(1)),
    restrictions: z.array(z.string().trim().min(1)),
    sex: z.string().trim().min(1).nullable(),
    height: z.string().trim().min(1).nullable(),
    weight: z.string().trim().min(1).nullable().default(null),
    eyeColor: z.string().trim().min(1).nullable(),
    hairColor: z.string().trim().min(1).nullable().default(null),
    organDonor: z.boolean().nullable(),
    veteran: z.boolean().nullable(),
    realId: z.boolean().nullable(),
    under21Until: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    ageAtScan: z.number().int().min(0).nullable(),
    isExpired: z.boolean(),
    confidenceScore: z.number().min(0).max(1),
    warnings: z.array(validationWarningSchema)
  })
  .strict();

export const uploadDocumentSchema = z.object({
  documentType: documentTypeSchema
});

export const documentRecordSchema = z.object({
  id: z.string(),
  filename: z.string(),
  documentType: documentTypeSchema,
  contentType: z.string(),
  storageKey: z.string(),
  status: z.enum(["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"]),
  validationStatus: validationStatusSchema.nullable(),
  extraction: structuredLicenseExtractionSchema.nullable(),
  rawOcr: z.any().nullable(),
  rawExtraction: z.any().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function parseDocumentRecord(input: unknown): DocumentRecord | null {
  const parsed = documentRecordSchema.safeParse(input);
  return parsed.success ? (parsed.data as DocumentRecord) : null;
}
