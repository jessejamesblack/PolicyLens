import { describe, expect, it } from "vitest";
import { parseDocumentRecord } from "./schemas";
import type { DocumentRecord } from "./types";

const currentRecord: DocumentRecord = {
  id: "record-1",
  filename: "ohio-real-id-front.png",
  documentType: "LicenseFront",
  contentType: "image/png",
  storageKey: "record-1",
  status: "PROCESSED",
  validationStatus: "VALID",
  extraction: {
    fullName: "Jordan Avery Sample",
    licenseNumber: "OH1234567",
    issuingState: "OH",
    dateOfBirth: "1990-09-12",
    issueDate: "2026-07-01",
    expirationDate: "2030-07-01",
    address: "100 Sample Lane, Columbus, OH",
    licenseClass: "D",
    endorsements: ["M"],
    restrictions: ["Corrective lenses"],
    sex: "X",
    height: "5-09",
    eyeColor: "BRO",
    organDonor: true,
    veteran: false,
    realId: true,
    under21Until: null,
    ageAtScan: 35,
    isExpired: false,
    confidenceScore: 0.91,
    warnings: []
  },
  rawOcr: { adapter: "test" },
  rawExtraction: { source: "test" },
  errorMessage: null,
  createdAt: "2026-07-04T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z"
};

describe("parseDocumentRecord", () => {
  it("returns current records and ignores incompatible stored shapes", () => {
    expect(parseDocumentRecord(currentRecord)).toEqual(currentRecord);
    expect(
      parseDocumentRecord({
        ...currentRecord,
        documentType: "UnsupportedDocument",
        extraction: { unsupported: true }
      })
    ).toBeNull();
  });
});
