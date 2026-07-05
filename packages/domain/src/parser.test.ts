import { describe, expect, it } from "vitest";
import { parseInsuranceDocumentText } from "./parser";

describe("parseInsuranceDocumentText", () => {
  it("extracts normalized policy fields from synthetic text", () => {
    const extraction = parseInsuranceDocumentText({
      documentType: "Policy",
      text: `
        Named Insured: Acme Logistics LLC
        Policy Number: GL-123456
        Line of Business: General Liability
        Risk State: IN
        Effective Date: 07/01/2026
        Expiration Date: 07/01/2027
        Total Premium: $125,000
        Per Occurrence Limit: $1,000,000
        Aggregate Limit: $2,000,000
        Confidence: 0.91
      `
    });

    expect(extraction).toMatchObject({
      insuredName: "Acme Logistics LLC",
      policyNumber: "GL-123456",
      lineOfBusiness: "General Liability",
      state: "IN",
      effectiveDate: "2026-07-01",
      expirationDate: "2027-07-01",
      premium: 125000,
      perOccurrenceLimit: 1000000,
      aggregateLimit: 2000000,
      confidenceScore: 0.91
    });
  });
});

