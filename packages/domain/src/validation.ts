import {
  StructuredLicenseExtraction,
  ValidatedExtraction,
  ValidationWarning
} from "./types";
import { structuredLicenseExtractionSchema } from "./schemas";

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function validateStructuredExtraction(
  input: StructuredLicenseExtraction,
  referenceDate: Date | string = new Date()
): ValidatedExtraction {
  const warnings: ValidationWarning[] = [...input.warnings];
  const parsed = structuredLicenseExtractionSchema.safeParse(input);
  const extraction = parsed.success ? parsed.data : input;

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      warnings.push({
        category: "SCHEMA_ERROR",
        field: typeof field === "string" && field in input ? (field as keyof StructuredLicenseExtraction) : "schema",
        message: issue.message,
        severity: "error"
      });
    }
  }

  if (!input.licenseNumber) {
    warnings.push({
      category: "MISSING_LICENSE_NUMBER",
      field: "licenseNumber",
      message: "License number is missing or ambiguous.",
      severity: "warning"
    });
  }

  if (!input.dateOfBirth) {
    warnings.push({
      category: "MISSING_DATE_OF_BIRTH",
      field: "dateOfBirth",
      message: "Date of birth is missing or unreadable.",
      severity: "warning"
    });
  }

  if (!input.issuingState) {
    warnings.push({
      category: "MISSING_ISSUING_STATE",
      field: "issuingState",
      message: "Issuing state is missing.",
      severity: "warning"
    });
  }

  if (!input.expirationDate) {
    warnings.push({
      category: "MISSING_EXPIRATION_DATE",
      field: "expirationDate",
      message: "Expiration date is missing or unreadable.",
      severity: "warning"
    });
  } else if (input.isExpired || Date.parse(`${input.expirationDate}T00:00:00.000Z`) < startOfDayUtc(referenceDate)) {
    warnings.push({
      category: "EXPIRED_LICENSE",
      field: "expirationDate",
      message: "License appears to be expired.",
      severity: "warning"
    });
  }

  if (input.ageAtScan !== null && input.ageAtScan < 21) {
    warnings.push({
      category: "UNDER_AGE_21",
      field: "dateOfBirth",
      message: "Cardholder is under 21 at scan time.",
      severity: "warning"
    });
  }

  if (input.confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
    warnings.push({
      category: "LOW_CONFIDENCE",
      field: "confidenceScore",
      message: `Confidence score is below ${LOW_CONFIDENCE_THRESHOLD}.`,
      severity: "warning"
    });
  }

  const dedupedWarnings = dedupeWarnings(warnings);
  const status = dedupedWarnings.some((warning) => warning.severity === "error")
    ? "FAILED"
    : dedupedWarnings.length > 0
      ? "WARNING"
      : "VALID";

  return {
    extraction: {
      ...extraction,
      warnings: dedupedWarnings
    },
    status,
    warnings: dedupedWarnings
  };
}

function startOfDayUtc(value: Date | string): number {
  const today = value instanceof Date ? value : new Date(value);
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

function dedupeWarnings(warnings: ValidationWarning[]): ValidationWarning[] {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.category}:${warning.field}:${warning.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
