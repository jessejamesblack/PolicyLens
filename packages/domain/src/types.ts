export const DOCUMENT_TYPES = ["LicenseFront", "LicenseBack", "TemporaryLicense", "LearnerPermit"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const EXTRACTION_SCHEMA_VERSION = "driverslicense.extraction.v2" as const;

export const PROCESSING_STATUSES = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "RETRYING",
  "PROCESSED",
  "FAILED",
  "DEAD_LETTER"
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const VALIDATION_STATUSES = ["VALID", "WARNING", "FAILED"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const WARNING_CATEGORIES = [
  "MISSING_LICENSE_NUMBER",
  "MISSING_DATE_OF_BIRTH",
  "MISSING_EXPIRATION_DATE",
  "MISSING_ISSUING_STATE",
  "EXPIRED_LICENSE",
  "UNDER_AGE_21",
  "LOW_CONFIDENCE",
  "SCHEMA_ERROR"
] as const;
export type WarningCategory = (typeof WARNING_CATEGORIES)[number];

export interface ValidationWarning {
  category: WarningCategory;
  field: string;
  message: string;
  severity: "warning" | "error";
}

export const LICENSE_FIELD_NAMES = [
  "fullName",
  "licenseNumber",
  "issuingState",
  "dateOfBirth",
  "issueDate",
  "expirationDate",
  "address",
  "licenseClass",
  "endorsements",
  "restrictions",
  "sex",
  "height",
  "weight",
  "eyeColor",
  "hairColor",
  "organDonor",
  "veteran",
  "realId",
  "under21Until",
  "ageAtScan",
  "isExpired"
] as const;
export type LicenseFieldName = (typeof LICENSE_FIELD_NAMES)[number];

export interface FieldConfidence {
  field: LicenseFieldName;
  confidence: number;
  source: "ocr" | "barcode" | "parser" | "manual";
  needsAdjudication: boolean;
}

export interface StructuredLicenseExtraction {
  schemaVersion: typeof EXTRACTION_SCHEMA_VERSION;
  fullName: string | null;
  licenseNumber: string | null;
  issuingState: string | null;
  dateOfBirth: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  address: string | null;
  licenseClass: string | null;
  endorsements: string[];
  restrictions: string[];
  sex: string | null;
  height: string | null;
  weight: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  organDonor: boolean | null;
  veteran: boolean | null;
  realId: boolean | null;
  under21Until: string | null;
  ageAtScan: number | null;
  isExpired: boolean;
  confidenceScore: number;
  fieldConfidences: FieldConfidence[];
  warnings: ValidationWarning[];
}

export interface ValidatedExtraction {
  extraction: StructuredLicenseExtraction;
  status: ValidationStatus;
  warnings: ValidationWarning[];
}

export interface OcrResult {
  text: string;
  confidenceScore: number;
  raw: unknown;
}

export interface BarcodeData {
  fullName: string | null;
  licenseNumber: string | null;
  issuingState: string | null;
  dateOfBirth: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  address: string | null;
  licenseClass: string | null;
  endorsements: string[];
  restrictions: string[];
  sex: string | null;
  height: string | null;
  weight: string | null;
  eyeColor: string | null;
  hairColor: string | null;
}

export interface BarcodeResult {
  format: "AAMVA_PDF417" | "NONE";
  parsed: BarcodeData | null;
  rawText: string | null;
  confidenceScore: number;
  warnings: string[];
}

export interface ExtractTextInput {
  documentId: string;
  filename: string;
  documentType: DocumentType;
  contentType: string;
  bytes?: Uint8Array;
  storageKey?: string;
}

export interface ExtractBarcodeInput extends ExtractTextInput {
  ocrText?: string;
}

export interface StructuredExtractionInput {
  documentId: string;
  filename: string;
  documentType: DocumentType;
  ocrText: string;
  ocrResult: OcrResult;
  barcodeResult?: BarcodeResult;
}

export interface DocumentOcrAdapter {
  extractText(input: ExtractTextInput): Promise<OcrResult>;
}

export interface DocumentBarcodeAdapter {
  extractBarcode(input: ExtractBarcodeInput): Promise<BarcodeResult>;
}

export interface StructuredExtractionAdapter {
  extractFields(input: StructuredExtractionInput): Promise<StructuredLicenseExtraction>;
}

export interface DocumentStorageAdapter {
  save(input: {
    documentId: string;
    filename: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<Uint8Array>;
}

export interface PreparedDirectUpload {
  documentId: string;
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export interface DirectUploadDocumentStorageAdapter extends DocumentStorageAdapter {
  prepareDirectUpload(input: {
    documentId: string;
    filename: string;
    contentType: string;
    contentLength: number;
  }): Promise<Omit<PreparedDirectUpload, "documentId">>;
}

export interface DocumentRepository {
  create(record: DocumentRecord): Promise<DocumentRecord>;
  update(record: DocumentRecord): Promise<DocumentRecord>;
  list(): Promise<DocumentRecord[]>;
  get(documentId: string): Promise<DocumentRecord | null>;
}

export interface DocumentProcessingJobMessage {
  documentId: string;
  attempt?: number;
}

export interface DocumentProcessingQueue {
  mode: "inline" | "external";
  enqueue(input: DocumentProcessingJobMessage): Promise<{
    messageId: string;
    enqueuedAt: string;
  }>;
}

export interface ProcessingJob {
  status: "QUEUED" | "PROCESSING" | "RETRYING" | "SUCCEEDED" | "FAILED" | "DEAD_LETTER";
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  queuedAt: string;
  updatedAt: string;
  messageId: string | null;
}

export interface PiiRetentionPolicy {
  retainOriginalFile: boolean;
  retainRawOcr: boolean;
  retainRawExtraction: boolean;
  rawRetentionDays: number;
  redactedCopyRequired: boolean;
}

export interface RedactionResult {
  redactedStorageKey: string | null;
  redactedContentType: string;
  redactedFilename: string;
  redactedFields: LicenseFieldName[];
  retainedRawOcr: boolean;
  retainedRawExtraction: boolean;
  notes: string[];
}

export interface RedactDocumentInput {
  documentId: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  ocrText: string;
  extraction: StructuredLicenseExtraction;
  policy: PiiRetentionPolicy;
}

export interface DocumentRedactionAdapter {
  redact(input: RedactDocumentInput): Promise<{
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    redactedFields: LicenseFieldName[];
    notes: string[];
  }>;
}

export interface ManualAdjudication {
  field: LicenseFieldName;
  previousValue: unknown;
  value: unknown;
  note: string | null;
  adjudicatedAt: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  documentType: DocumentType;
  contentType: string;
  storageKey: string;
  status: ProcessingStatus;
  validationStatus: ValidationStatus | null;
  extraction: StructuredLicenseExtraction | null;
  barcode: BarcodeResult | null;
  rawOcr: unknown | null;
  rawExtraction: unknown | null;
  redaction: RedactionResult | null;
  piiRetention: PiiRetentionPolicy;
  processingJob: ProcessingJob | null;
  adjudications: ManualAdjudication[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardFilters {
  issuingState?: string | null;
  documentType?: DocumentType | null;
  validationStatus?: ValidationStatus | null;
  expirationBucket?: string | null;
}

export interface DashboardSummary {
  documentsProcessed: number;
  activeFilters: DashboardFilters;
  averageConfidence: number;
  warningCount: number;
  realIdCount: number;
  organDonorCount: number;
  veteranCount: number;
  expiredCount: number;
  under21Count: number;
  averageAge: number;
  documentsByIssuingState: Array<{
    issuingState: string;
    documentCount: number;
  }>;
  documentsByStatus: Array<{
    status: ValidationStatus;
    count: number;
  }>;
  averageConfidenceByDocumentType: Array<{
    documentType: DocumentType;
    averageConfidence: number;
    documentCount: number;
  }>;
  warningCountByCategory: Array<{
    category: WarningCategory;
    count: number;
  }>;
  expirationBuckets: Array<{
    bucket: string;
    count: number;
  }>;
}
