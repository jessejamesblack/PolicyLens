import {
  StructuredPolicyExtraction,
  ValidatedExtraction,
  ValidationWarning
} from "./types";
import { structuredPolicyExtractionSchema } from "./schemas";

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function validateStructuredExtraction(input: StructuredPolicyExtraction): ValidatedExtraction {
  const warnings: ValidationWarning[] = [...input.warnings];
  const parsed = structuredPolicyExtractionSchema.safeParse(input);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      warnings.push({
        category: "SCHEMA_ERROR",
        field: typeof field === "string" && field in input ? (field as keyof StructuredPolicyExtraction) : "schema",
        message: issue.message,
        severity: "error"
      });
    }
  }

  if (!input.policyNumber) {
    warnings.push({
      category: "MISSING_POLICY_NUMBER",
      field: "policyNumber",
      message: "Policy number is missing or ambiguous.",
      severity: "warning"
    });
  }

  if (!input.lineOfBusiness) {
    warnings.push({
      category: "MISSING_LINE_OF_BUSINESS",
      field: "lineOfBusiness",
      message: "Line of business is missing.",
      severity: "warning"
    });
  }

  if (!input.state) {
    warnings.push({
      category: "MISSING_STATE",
      field: "state",
      message: "Risk state is missing.",
      severity: "warning"
    });
  }

  if (input.premium !== null && input.premium <= 0) {
    warnings.push({
      category: "INVALID_PREMIUM",
      field: "premium",
      message: "Premium must be a positive number.",
      severity: "error"
    });
  }

  if (input.effectiveDate && input.expirationDate) {
    const effectiveDate = Date.parse(input.effectiveDate);
    const expirationDate = Date.parse(input.expirationDate);

    if (!Number.isNaN(effectiveDate) && !Number.isNaN(expirationDate) && effectiveDate >= expirationDate) {
      warnings.push({
        category: "INVALID_DATE_RANGE",
        field: "effectiveDate",
        message: "Effective date must be before expiration date.",
        severity: "error"
      });
    }
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
      ...input,
      warnings: dedupedWarnings
    },
    status,
    warnings: dedupedWarnings
  };
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
