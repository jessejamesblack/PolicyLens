export const DOCUMENT_TYPES = ["LicenseFront", "LicenseBack", "TemporaryLicense", "LearnerPermit"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PROCESSING_STATUSES = ["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"] as const;
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

export interface StructuredLicenseExtraction {
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

export interface ExtractTextInput {
  documentId: string;
  filename: string;
  documentType: DocumentType;
  contentType: string;
  bytes?: Uint8Array;
  storageKey?: string;
}

export interface StructuredExtractionInput {
  documentId: string;
  filename: string;
  documentType: DocumentType;
  ocrText: string;
  ocrResult: OcrResult;
}

export interface DocumentOcrAdapter {
  extractText(input: ExtractTextInput): Promise<OcrResult>;
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

export interface DocumentRepository {
  create(record: DocumentRecord): Promise<DocumentRecord>;
  update(record: DocumentRecord): Promise<DocumentRecord>;
  list(): Promise<DocumentRecord[]>;
  get(documentId: string): Promise<DocumentRecord | null>;
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
  rawOcr: unknown | null;
  rawExtraction: unknown | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  documentsProcessed: number;
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
