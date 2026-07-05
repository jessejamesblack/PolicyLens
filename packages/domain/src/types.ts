export const DOCUMENT_TYPES = ["Policy", "Submission", "Claim", "Endorsement"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PROCESSING_STATUSES = ["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const VALIDATION_STATUSES = ["VALID", "WARNING", "FAILED"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const WARNING_CATEGORIES = [
  "MISSING_POLICY_NUMBER",
  "MISSING_LINE_OF_BUSINESS",
  "MISSING_STATE",
  "LOW_CONFIDENCE",
  "INVALID_PREMIUM",
  "INVALID_DATE_RANGE",
  "SCHEMA_ERROR"
] as const;
export type WarningCategory = (typeof WARNING_CATEGORIES)[number];

export interface ValidationWarning {
  category: WarningCategory;
  field: string;
  message: string;
  severity: "warning" | "error";
}

export interface StructuredPolicyExtraction {
  insuredName: string | null;
  policyNumber: string | null;
  lineOfBusiness: string | null;
  state: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  premium: number | null;
  perOccurrenceLimit: number | null;
  aggregateLimit: number | null;
  confidenceScore: number;
  warnings: ValidationWarning[];
}

export interface ValidatedExtraction {
  extraction: StructuredPolicyExtraction;
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
  extractFields(input: StructuredExtractionInput): Promise<StructuredPolicyExtraction>;
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
  extraction: StructuredPolicyExtraction | null;
  rawOcr: unknown | null;
  rawExtraction: unknown | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  documentsProcessed: number;
  totalPremium: number;
  averageConfidence: number;
  warningCount: number;
  premiumByLineOfBusiness: Array<{
    lineOfBusiness: string;
    premium: number;
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
}
