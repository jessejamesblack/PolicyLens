import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  buildDashboardSummary,
  DocumentOcrAdapter,
  DocumentRecord,
  DocumentRepository,
  DocumentStorageAdapter,
  DocumentType,
  StructuredExtractionAdapter,
  validateStructuredExtraction
} from "@driverslicense/domain";
import { randomUUID } from "node:crypto";
import {
  DOCUMENT_REPOSITORY,
  DOCUMENT_STORAGE,
  OCR_ADAPTER,
  STRUCTURED_EXTRACTION_ADAPTER
} from "../tokens";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorageAdapter,
    @Inject(DOCUMENT_REPOSITORY) private readonly repository: DocumentRepository,
    @Inject(OCR_ADAPTER) private readonly ocrAdapter: DocumentOcrAdapter,
    @Inject(STRUCTURED_EXTRACTION_ADAPTER)
    private readonly structuredExtractionAdapter: StructuredExtractionAdapter
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
      rawOcr: null,
      rawExtraction: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    });
  }

  async process(documentId: string): Promise<DocumentRecord> {
    const record = await this.getRecordOrThrow(documentId);
    const processingRecord = await this.repository.update({
      ...record,
      status: "PROCESSING",
      errorMessage: null,
      updatedAt: new Date().toISOString()
    });

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
      const extractedFields = await this.structuredExtractionAdapter.extractFields({
        documentId: processingRecord.id,
        filename: processingRecord.filename,
        documentType: processingRecord.documentType,
        ocrText: ocrResult.text,
        ocrResult
      });
      const validated = validateStructuredExtraction(extractedFields);

      return this.repository.update({
        ...processingRecord,
        status: "PROCESSED",
        validationStatus: validated.status,
        extraction: validated.extraction,
        rawOcr: ocrResult.raw,
        rawExtraction: extractedFields,
        errorMessage: null,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      const failedRecord = await this.repository.update({
        ...processingRecord,
        status: "FAILED",
        validationStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown processing error.",
        updatedAt: new Date().toISOString()
      });

      return failedRecord;
    }
  }

  async list(): Promise<DocumentRecord[]> {
    return this.repository.list();
  }

  async get(documentId: string): Promise<DocumentRecord> {
    return this.getRecordOrThrow(documentId);
  }

  async dashboardSummary() {
    return buildDashboardSummary(await this.repository.list());
  }

  private async getRecordOrThrow(documentId: string): Promise<DocumentRecord> {
    const record = await this.repository.get(documentId);

    if (!record) {
      throw new NotFoundException(`Document ${documentId} was not found.`);
    }

    return record;
  }
}

