import { z } from "zod";
import { DOCUMENT_TYPES, VALIDATION_STATUSES, WARNING_CATEGORIES } from "./types";

export const validationWarningSchema = z.object({
  category: z.enum(WARNING_CATEGORIES),
  field: z.string(),
  message: z.string(),
  severity: z.enum(["warning", "error"])
});

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);

export const structuredPolicyExtractionSchema = z
  .object({
    insuredName: z.string().trim().min(1).nullable(),
    policyNumber: z.string().trim().min(1).nullable(),
    lineOfBusiness: z.string().trim().min(1).nullable(),
    state: z.string().trim().length(2).nullable(),
    effectiveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    expirationDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    premium: z.number().nullable(),
    perOccurrenceLimit: z.number().nullable(),
    aggregateLimit: z.number().nullable(),
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
  extraction: structuredPolicyExtractionSchema.nullable(),
  rawOcr: z.any().nullable(),
  rawExtraction: z.any().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
