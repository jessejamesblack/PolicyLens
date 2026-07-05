import { describe, expect, it } from "vitest";
import {
  DocumentRecord,
  DocumentRepository,
  DocumentStorageAdapter,
  parseDriverLicenseText
} from "@driverslicense/domain";
import { DocumentsService } from "./documents.service";
import { MockOcrAdapter } from "../infrastructure/mock-ocr.adapter";
import { DeterministicStructuredExtractionAdapter } from "../infrastructure/deterministic-structured-extraction.adapter";

class MemoryStorage implements DocumentStorageAdapter {
  private readonly files = new Map<string, Uint8Array>();

  async save(input: { documentId: string; filename: string; contentType: string; bytes: Uint8Array }) {
    this.files.set(input.documentId, input.bytes);
    return { storageKey: input.documentId };
  }

  async read(storageKey: string) {
    const bytes = this.files.get(storageKey);

    if (!bytes) {
      throw new Error("Missing test file.");
    }

    return bytes;
  }
}

class MemoryRepository implements DocumentRepository {
  private readonly records = new Map<string, DocumentRecord>();

  async create(record: DocumentRecord) {
    this.records.set(record.id, record);
    return record;
  }

  async update(record: DocumentRecord) {
    this.records.set(record.id, record);
    return record;
  }

  async list() {
    return [...this.records.values()];
  }

  async get(documentId: string) {
    return this.records.get(documentId) ?? null;
  }
}

describe("DocumentsService", () => {
  it("uploads, processes, stores extraction, and builds dashboard metrics", async () => {
    const service = new DocumentsService(
      new MemoryStorage(),
      new MemoryRepository(),
      new MockOcrAdapter(),
      new DeterministicStructuredExtractionAdapter()
    );

    const upload = await service.upload({
      filename: "ohio-real-id-front.txt",
      documentType: "LicenseFront",
      contentType: "text/plain",
      bytes: Buffer.from(`SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Jordan Avery Sample
License Number: OH1234567
Issuing State: OH
Date of Birth: 1990-09-12
Issue Date: 2026-07-01
Expiration Date: 2030-07-01
Address: 100 Sample Lane, Columbus, OH
License Class: D
Endorsements: M
Restrictions: Corrective lenses
Organ Donor: Yes
Veteran: No
REAL ID: Yes
Confidence: 0.91`)
    });

    const processed = await service.process(upload.id);
    const summary = await service.dashboardSummary();

    expect(processed.status).toBe("PROCESSED");
    expect(processed.validationStatus).toBe("VALID");
    expect(processed.extraction?.licenseNumber).toBe("OH1234567");
    expect(processed.extraction?.issuingState).toBe("OH");
    expect(summary.documentsProcessed).toBe(1);
    expect(summary.realIdCount).toBe(1);
  });

  it("keeps deterministic extraction behavior available for the harness", () => {
    const extraction = parseDriverLicenseText({
      documentType: "TemporaryLicense",
      referenceDate: "2026-07-04T00:00:00.000Z",
      text: "Full Name: Avery Chen Sample\nIssuing State: NY\nDate of Birth: 1999-12-02\nConfidence: 0.84"
    });

    expect(extraction.licenseNumber).toBeNull();
    expect(extraction.issuingState).toBe("NY");
  });
});
