import { describe, expect, it } from "vitest";
import { StructuredPolicyExtraction } from "./types";
import { validateStructuredExtraction } from "./validation";

const baseExtraction: StructuredPolicyExtraction = {
  insuredName: "Acme Logistics LLC",
  policyNumber: "GL-123456",
  lineOfBusiness: "General Liability",
  state: "IN",
  effectiveDate: "2026-07-01",
  expirationDate: "2027-07-01",
  premium: 125000,
  perOccurrenceLimit: 1000000,
  aggregateLimit: 2000000,
  confidenceScore: 0.91,
  warnings: []
};

describe("validateStructuredExtraction", () => {
  it("marks a complete extraction valid", () => {
    const result = validateStructuredExtraction(baseExtraction);
    expect(result.status).toBe("VALID");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when policy number is missing", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, policyNumber: null });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toContain("MISSING_POLICY_NUMBER");
  });

  it("fails when premium is not positive", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, premium: -5 });
    expect(result.status).toBe("FAILED");
    expect(result.warnings.map((warning) => warning.category)).toContain("INVALID_PREMIUM");
  });

  it("fails when effective date is not before expiration date", () => {
    const result = validateStructuredExtraction({
      ...baseExtraction,
      effectiveDate: "2027-07-01",
      expirationDate: "2026-07-01"
    });
    expect(result.status).toBe("FAILED");
    expect(result.warnings.map((warning) => warning.category)).toContain("INVALID_DATE_RANGE");
  });

  it("rejects confidence scores outside 0 and 1", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, confidenceScore: 1.4 });
    expect(result.status).toBe("FAILED");
    expect(result.warnings.map((warning) => warning.category)).toContain("SCHEMA_ERROR");
  });

  it("warns when line of business and state are missing", () => {
    const result = validateStructuredExtraction({
      ...baseExtraction,
      lineOfBusiness: null,
      state: null
    });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toEqual(
      expect.arrayContaining(["MISSING_LINE_OF_BUSINESS", "MISSING_STATE"])
    );
  });
});

