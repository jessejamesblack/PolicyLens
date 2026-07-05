import { describe, expect, it } from "vitest";
import { EXTRACTION_SCHEMA_VERSION, StructuredLicenseExtraction } from "./types";
import { validateStructuredExtraction } from "./validation";

const baseExtraction: StructuredLicenseExtraction = {
  schemaVersion: EXTRACTION_SCHEMA_VERSION,
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
  weight: "175",
  eyeColor: "BRO",
  hairColor: "BRO",
  organDonor: true,
  veteran: false,
  realId: true,
  under21Until: null,
  ageAtScan: 35,
  isExpired: false,
  confidenceScore: 0.91,
  fieldConfidences: [],
  warnings: []
};

describe("validateStructuredExtraction", () => {
  it("marks a complete extraction valid", () => {
    const result = validateStructuredExtraction(baseExtraction);
    expect(result.status).toBe("VALID");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when license number is missing", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, licenseNumber: null });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toContain("MISSING_LICENSE_NUMBER");
  });

  it("warns when date of birth is missing", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, dateOfBirth: null, ageAtScan: null });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toContain("MISSING_DATE_OF_BIRTH");
  });

  it("warns when issuing state and expiration date are missing", () => {
    const result = validateStructuredExtraction({
      ...baseExtraction,
      issuingState: null,
      expirationDate: null
    });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toEqual(
      expect.arrayContaining(["MISSING_ISSUING_STATE", "MISSING_EXPIRATION_DATE"])
    );
  });

  it("rejects confidence scores outside 0 and 1", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, confidenceScore: 1.4 });
    expect(result.status).toBe("FAILED");
    expect(result.warnings.map((warning) => warning.category)).toContain("SCHEMA_ERROR");
  });

  it("warns when the license appears expired", () => {
    const result = validateStructuredExtraction({
      ...baseExtraction,
      expirationDate: "2020-01-01",
      isExpired: true
    });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toContain("EXPIRED_LICENSE");
  });

  it("warns when the cardholder is under 21", () => {
    const result = validateStructuredExtraction({ ...baseExtraction, ageAtScan: 19 });
    expect(result.status).toBe("WARNING");
    expect(result.warnings.map((warning) => warning.category)).toContain("UNDER_AGE_21");
  });

  it("points low-confidence field warnings at the field that needs a human check", () => {
    const result = validateStructuredExtraction({
      ...baseExtraction,
      fieldConfidences: [
        {
          field: "licenseNumber",
          confidence: 0.58,
          source: "ocr",
          needsAdjudication: true
        }
      ]
    });

    expect(result.status).toBe("WARNING");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        category: "LOW_CONFIDENCE",
        field: "licenseNumber"
      })
    );
  });
});
