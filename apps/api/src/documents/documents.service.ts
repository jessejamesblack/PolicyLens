import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  buildDashboardSummary,
  DashboardFilters,
  DocumentBarcodeAdapter,
  DocumentOcrAdapter,
  DocumentProcessingQueue,
  DocumentRecord,
  DocumentRepository,
  DocumentRedactionAdapter,
  DocumentStorageAdapter,
  DocumentType,
  LICENSE_FIELD_NAMES,
  LicenseFieldName,
  ManualAdjudication,
  PiiRetentionPolicy,
  ProcessingJob,
  StructuredExtractionAdapter,
  StructuredLicenseExtraction,
  validateStructuredExtraction
} from "@driverslicense/domain";
import { randomUUID } from "node:crypto";
import {
  BARCODE_ADAPTER,
  DOCUMENT_PROCESSING_QUEUE,
  DOCUMENT_REPOSITORY,
  DOCUMENT_STORAGE,
  OCR_ADAPTER,
  REDACTION_ADAPTER,
  STRUCTURED_EXTRACTION_ADAPTER
} from "../tokens";
import { redactRawPayload } from "../infrastructure/share-safe-redaction.adapter";

const DEFAULT_MAX_PROCESSING_ATTEMPTS = 3;

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorageAdapter,
    @Inject(DOCUMENT_REPOSITORY) private readonly repository: DocumentRepository,
    @Inject(OCR_ADAPTER) private readonly ocrAdapter: DocumentOcrAdapter,
    @Inject(BARCODE_ADAPTER) private readonly barcodeAdapter: DocumentBarcodeAdapter,
    @Inject(STRUCTURED_EXTRACTION_ADAPTER)
    private readonly structuredExtractionAdapter: StructuredExtractionAdapter,
    @Inject(REDACTION_ADAPTER) private readonly redactionAdapter: DocumentRedactionAdapter,
    @Inject(DOCUMENT_PROCESSING_QUEUE) private readonly processingQueue: DocumentProcessingQueue
  ) {}

  async upload(input: {
    filename: string;
    documentType: DocumentType;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const documentId = randomUUID();
    const saved = await this.storage.save({
      documentId,
      filename: input.filename,
      contentType: input.contentType,
      bytes: input.bytes
    });

    return this.repository.create({
      id: documentId,
      filename: input.filename,
      documentType: input.documentType,
      contentType: input.contentType,
      storageKey: saved.storageKey,
      status: "UPLOADED",
      validationStatus: null,
      extraction: null,
      barcode: null,
      rawOcr: null,
      rawExtraction: null,
      redaction: null,
      piiRetention: buildPiiRetentionPolicy(),
      processingJob: null,
      adjudications: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    });
  }

  async process(documentId: string): Promise<DocumentRecord> {
    return this.enqueueProcessing(documentId);
  }

  async enqueueProcessing(documentId: string): Promise<DocumentRecord> {
    const record = await this.getRecordOrThrow(documentId);
    const now = new Date().toISOString();
    const maxAttempts = record.processingJob?.maxAttempts ?? processingAttempts();
    const queueMessage = await this.processingQueue.enqueue({
      documentId,
      attempt: (record.processingJob?.attempts ?? 0) + 1
    });
    const queuedRecord = await this.repository.update({
      ...record,
      status: "QUEUED",
      processingJob: {
        status: "QUEUED",
        attempts: record.processingJob?.attempts ?? 0,
        maxAttempts,
        lastError: null,
        queuedAt: record.processingJob?.queuedAt ?? now,
        updatedAt: now,
        messageId: queueMessage.messageId
      },
      errorMessage: null,
      updatedAt: now
    });

    if (this.processingQueue.mode === "inline") {
      setTimeout(() => {
        void this.processWithRetry(documentId);
      }, 0);
    }

    return queuedRecord;
  }

  async processWithRetry(documentId: string): Promise<DocumentRecord> {
    let record = await this.getRecordOrThrow(documentId);
    const maxAttempts = record.processingJob?.maxAttempts ?? processingAttempts();
    let lastError: unknown = null;

    for (let attempt = (record.processingJob?.attempts ?? 0) + 1; attempt <= maxAttempts; attempt += 1) {
      const now = new Date().toISOString();
      const processingStatus = attempt > 1 ? "RETRYING" : "PROCESSING";
      const processingRecord = await this.repository.update({
        ...record,
        status: processingStatus,
        processingJob: updateProcessingJob(record.processingJob, {
          status: processingStatus,
          attempts: attempt,
          maxAttempts,
          lastError: null,
          updatedAt: now
        }),
        errorMessage: null,
        updatedAt: now
      });

      try {
        return await this.processOnce(processingRecord);
      } catch (error) {
        lastError = error;
        record = await this.repository.update({
          ...processingRecord,
          status: attempt >= maxAttempts ? "DEAD_LETTER" : "RETRYING",
          validationStatus: attempt >= maxAttempts ? "FAILED" : processingRecord.validationStatus,
          processingJob: updateProcessingJob(processingRecord.processingJob, {
            status: attempt >= maxAttempts ? "DEAD_LETTER" : "RETRYING",
            attempts: attempt,
            maxAttempts,
            lastError: errorMessage(error),
            updatedAt: new Date().toISOString()
          }),
          errorMessage: errorMessage(error),
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (lastError) {
      return {
        ...record,
        errorMessage: errorMessage(lastError)
      };
    }

    return record;
  }

  private async processOnce(processingRecord: DocumentRecord): Promise<DocumentRecord> {
    try {
      const bytes = await this.storage.read(processingRecord.storageKey);
      const ocrResult = await this.ocrAdapter.extractText({
        documentId: processingRecord.id,
        filename: processingRecord.filename,
        documentType: processingRecord.documentType,
        contentType: processingRecord.contentType,
        storageKey: processingRecord.storageKey,
        bytes
      });
      const barcodeResult = await this.barcodeAdapter.extractBarcode({
        documentId: processingRecord.id,
        filename: processingRecord.filename,
        documentType: processingRecord.documentType,
        contentType: processingRecord.contentType,
        storageKey: processingRecord.storageKey,
        bytes,
        ocrText: ocrResult.text
      });
      const extractedFields = await this.structuredExtractionAdapter.extractFields({
        documentId: processingRecord.id,
        filename: processingRecord.filename,
        documentType: processingRecord.documentType,
        ocrText: ocrResult.text,
        ocrResult,
        barcodeResult
      });
      const validated = validateStructuredExtraction(extractedFields);
      const retentionPolicy = processingRecord.piiRetention ?? buildPiiRetentionPolicy();
      const redacted = await this.redactionAdapter.redact({
        documentId: processingRecord.id,
        filename: processingRecord.filename,
        contentType: processingRecord.contentType,
        bytes,
        ocrText: ocrResult.text,
        extraction: validated.extraction,
        policy: retentionPolicy
      });
      const redactedStorage = await this.storage.save({
        documentId: `${processingRecord.id}-redacted`,
        filename: redacted.filename,
        contentType: redacted.contentType,
        bytes: redacted.bytes
      });

      return this.repository.update({
        ...processingRecord,
        status: "PROCESSED",
        validationStatus: validated.status,
        extraction: validated.extraction,
        barcode: barcodeResult,
        rawOcr: retentionPolicy.retainRawOcr ? ocrResult.raw : redactRawPayload(ocrResult.raw),
        rawExtraction: retentionPolicy.retainRawExtraction
          ? extractedFields
          : redactRawExtraction(extractedFields, redacted.redactedFields),
        redaction: {
          redactedStorageKey: redactedStorage.storageKey,
          redactedContentType: redacted.contentType,
          redactedFilename: redacted.filename,
          redactedFields: redacted.redactedFields,
          retainedRawOcr: retentionPolicy.retainRawOcr,
          retainedRawExtraction: retentionPolicy.retainRawExtraction,
          notes: redacted.notes
        },
        piiRetention: retentionPolicy,
        processingJob: updateProcessingJob(processingRecord.processingJob, {
          status: "SUCCEEDED",
          attempts: processingRecord.processingJob?.attempts ?? 1,
          maxAttempts: processingRecord.processingJob?.maxAttempts ?? processingAttempts(),
          lastError: null,
          updatedAt: new Date().toISOString()
        }),
        errorMessage: null,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      throw error;
    }
  }

  async list(): Promise<DocumentRecord[]> {
    return this.repository.list();
  }

  async get(documentId: string): Promise<DocumentRecord> {
    return this.getRecordOrThrow(documentId);
  }

  async dashboardSummary(filters: DashboardFilters = {}) {
    return buildDashboardSummary(await this.repository.list(), new Date(), filters);
  }

  async adjudicate(input: {
    documentId: string;
    field: LicenseFieldName;
    value: unknown;
    note?: string | null;
  }): Promise<DocumentRecord> {
    if (!LICENSE_FIELD_NAMES.includes(input.field)) {
      throw new NotFoundException(`Field ${input.field} was not found.`);
    }

    const record = await this.getRecordOrThrow(input.documentId);
    if (!record.extraction) {
      throw new NotFoundException(`Document ${input.documentId} has no extraction to adjudicate.`);
    }

    const previousValue = record.extraction[input.field];
    const extraction = {
      ...record.extraction,
      [input.field]: input.value,
      fieldConfidences: upsertManualConfidence(record.extraction, input.field)
    } as StructuredLicenseExtraction;
    const validated = validateStructuredExtraction(extraction);
    const adjudication: ManualAdjudication = {
      field: input.field,
      previousValue,
      value: input.value,
      note: input.note ?? null,
      adjudicatedAt: new Date().toISOString()
    };

    return this.repository.update({
      ...record,
      extraction: validated.extraction,
      validationStatus: validated.status,
      adjudications: [...(record.adjudications ?? []), adjudication],
      updatedAt: new Date().toISOString()
    });
  }

  private async getRecordOrThrow(documentId: string): Promise<DocumentRecord> {
    const record = await this.repository.get(documentId);

    if (!record) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }

    return record;
  }
}

function buildPiiRetentionPolicy(): PiiRetentionPolicy {
  const retainRaw = process.env.RETAIN_RAW_PII === "true";

  return {
    retainOriginalFile: process.env.RETAIN_ORIGINAL_FILE !== "false",
    retainRawOcr: process.env.RETAIN_RAW_OCR === "true" || retainRaw,
    retainRawExtraction: process.env.RETAIN_RAW_EXTRACTION === "true" || retainRaw,
    rawRetentionDays: Number(process.env.RAW_PII_RETENTION_DAYS ?? 7),
    redactedCopyRequired: process.env.REDACTED_COPY_REQUIRED !== "false"
  };
}

function processingAttempts(): number {
  return Number(process.env.PROCESSING_MAX_ATTEMPTS ?? DEFAULT_MAX_PROCESSING_ATTEMPTS);
}

function updateProcessingJob(
  existing: ProcessingJob | null,
  patch: Pick<ProcessingJob, "status" | "attempts" | "maxAttempts" | "lastError" | "updatedAt">
): ProcessingJob {
  return {
    status: patch.status,
    attempts: patch.attempts,
    maxAttempts: patch.maxAttempts,
    lastError: patch.lastError,
    queuedAt: existing?.queuedAt ?? patch.updatedAt,
    updatedAt: patch.updatedAt,
    messageId: existing?.messageId ?? null
  };
}

function redactRawExtraction(
  extraction: StructuredLicenseExtraction,
  redactedFields: LicenseFieldName[]
): StructuredLicenseExtraction {
  const redacted = {
    ...extraction,
    fieldConfidences: extraction.fieldConfidences.map((confidence) =>
      redactedFields.includes(confidence.field)
        ? {
            ...confidence,
            source: "parser" as const
          }
        : confidence
    )
  };

  for (const field of redactedFields) {
    (redacted as Record<string, unknown>)[field] = "[REDACTED]";
  }

  return redacted as StructuredLicenseExtraction;
}

function upsertManualConfidence(
  extraction: StructuredLicenseExtraction,
  field: LicenseFieldName
): StructuredLicenseExtraction["fieldConfidences"] {
  const existing = extraction.fieldConfidences.filter((confidence) => confidence.field !== field);

  return [
    ...existing,
    {
      field,
      confidence: 1,
      source: "manual",
      needsAdjudication: false
    }
  ];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown processing error.";
}
