import { z } from "zod";
import {
  DOCUMENT_TYPES,
  EXTRACTION_SCHEMA_VERSION,
  LICENSE_FIELD_NAMES,
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
export const licenseFieldNameSchema = z.enum(LICENSE_FIELD_NAMES);

export const fieldConfidenceSchema = z.object({
  field: licenseFieldNameSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(["ocr", "barcode", "parser", "manual"]),
  needsAdjudication: z.boolean()
});

export const structuredLicenseExtractionSchema = z
  .object({
    schemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION).default(EXTRACTION_SCHEMA_VERSION),
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
    fieldConfidences: z.array(fieldConfidenceSchema).default([]),
    warnings: z.array(validationWarningSchema)
  })
  .strict();

export const uploadDocumentSchema = z.object({
  documentType: documentTypeSchema
});

export const prepareDirectUploadSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  documentType: documentTypeSchema,
  contentType: z.string().trim().min(1).max(120),
  contentLength: z.number().int().positive().max(30 * 1024 * 1024)
});

export const barcodeDataSchema = z.object({
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
  weight: z.string().trim().min(1).nullable(),
  eyeColor: z.string().trim().min(1).nullable(),
  hairColor: z.string().trim().min(1).nullable()
});

export const barcodeResultSchema = z.object({
  format: z.enum(["AAMVA_PDF417", "NONE"]),
  parsed: barcodeDataSchema.nullable(),
  rawText: z.string().nullable(),
  confidenceScore: z.number().min(0).max(1),
  warnings: z.array(z.string())
});

export const piiRetentionPolicySchema = z.object({
  retainOriginalFile: z.boolean(),
  retainRawOcr: z.boolean(),
  retainRawExtraction: z.boolean(),
  rawRetentionDays: z.number().int().min(0),
  redactedCopyRequired: z.boolean()
});

export const redactionResultSchema = z.object({
  redactedStorageKey: z.string().nullable(),
  redactedContentType: z.string(),
  redactedFilename: z.string(),
  redactedFields: z.array(licenseFieldNameSchema),
  retainedRawOcr: z.boolean(),
  retainedRawExtraction: z.boolean(),
  notes: z.array(z.string())
});

export const processingJobSchema = z.object({
  status: z.enum(["QUEUED", "PROCESSING", "RETRYING", "SUCCEEDED", "FAILED", "DEAD_LETTER"]),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  lastError: z.string().nullable(),
  queuedAt: z.string(),
  updatedAt: z.string(),
  messageId: z.string().nullable()
});

export const manualAdjudicationSchema = z.object({
  field: licenseFieldNameSchema,
  previousValue: z.unknown(),
  value: z.unknown(),
  note: z.string().nullable(),
  adjudicatedAt: z.string()
});

export const documentRecordSchema = z.object({
  id: z.string(),
  filename: z.string(),
  documentType: documentTypeSchema,
  contentType: z.string(),
  storageKey: z.string(),
  status: z.enum(["UPLOADED", "QUEUED", "PROCESSING", "RETRYING", "PROCESSED", "FAILED", "DEAD_LETTER"]),
  validationStatus: validationStatusSchema.nullable(),
  extraction: structuredLicenseExtractionSchema.nullable(),
  barcode: barcodeResultSchema.nullable().default(null),
  rawOcr: z.any().nullable(),
  rawExtraction: z.any().nullable(),
  redaction: redactionResultSchema.nullable().default(null),
  piiRetention: piiRetentionPolicySchema.default({
    retainOriginalFile: true,
    retainRawOcr: false,
    retainRawExtraction: false,
    rawRetentionDays: 7,
    redactedCopyRequired: true
  }),
  processingJob: processingJobSchema.nullable().default(null),
  adjudications: z.array(manualAdjudicationSchema).default([]),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export function parseDocumentRecord(input: unknown): DocumentRecord | null {
  const parsed = documentRecordSchema.safeParse(input);
  return parsed.success ? (parsed.data as DocumentRecord) : null;
}
