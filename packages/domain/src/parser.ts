import {
  DocumentType,
  OcrResult,
  StructuredPolicyExtraction,
  ValidationWarning
} from "./types";

const LINE_OF_BUSINESS_ALIASES = [
  "General Liability",
  "Property",
  "Commercial Auto",
  "Cyber",
  "Workers Comp",
  "Workers Compensation"
];

export function parseInsuranceDocumentText(input: {
  text: string;
  documentType: DocumentType;
  ocrResult?: OcrResult;
}): StructuredPolicyExtraction {
  const text = normalizeWhitespace(input.text);
  const warnings: ValidationWarning[] = [];
  const insuredName = findString(text, ["Insured", "Named Insured", "Applicant", "Account"]);
  const policyNumber = findPolicyNumber(text);
  const lineOfBusiness =
    findString(text, ["Line of Business", "LOB", "Coverage"]) ?? inferLineOfBusiness(text);
  const state = normalizeState(findString(text, ["State", "Risk State", "Primary State"]));
  const effectiveDate = normalizeDate(findString(text, ["Effective Date", "Policy Effective"]));
  const expirationDate = normalizeDate(findString(text, ["Expiration Date", "Policy Expiration"]));
  const premium = findMoney(text, ["Premium", "Estimated Premium", "Total Premium"]);
  const perOccurrenceLimit = findMoney(text, ["Per Occurrence Limit", "Occurrence Limit"]);
  const aggregateLimit = findMoney(text, ["Aggregate Limit", "General Aggregate"]);
  const confidenceScore = findConfidence(text) ?? input.ocrResult?.confidenceScore ?? 0.86;

  if (!policyNumber && input.documentType !== "Submission") {
    warnings.push({
      category: "MISSING_POLICY_NUMBER",
      field: "policyNumber",
      message: "No policy number was found in the source text.",
      severity: "warning"
    });
  }

  return {
    insuredName,
    policyNumber,
    lineOfBusiness,
    state,
    effectiveDate,
    expirationDate,
    premium,
    perOccurrenceLimit,
    aggregateLimit,
    confidenceScore,
    warnings
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function findString(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:\\-]\\s*(.+)`, "i");
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanupValue(match[1]);
    }
  }

  return null;
}

function findPolicyNumber(text: string): string | null {
  return (
    findString(text, ["Policy Number", "Policy No", "Policy #"]) ??
    text.match(/\b[A-Z]{2,4}-\d{4,8}\b/)?.[0] ??
    null
  );
}

function inferLineOfBusiness(text: string): string | null {
  return LINE_OF_BUSINESS_ALIASES.find((alias) => text.toLowerCase().includes(alias.toLowerCase())) ?? null;
}

function normalizeState(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.toUpperCase().match(/\b[A-Z]{2}\b/);
  return match?.[0] ?? null;
}

function normalizeDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function findMoney(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:\\-]\\s*\\$?([0-9,]+(?:\\.\\d{2})?)`, "i");
    const match = text.match(pattern);

    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

function findConfidence(text: string): number | null {
  const match = text.match(/Confidence\s*[:\-]\s*(0?\.\d+|1(?:\.0)?|\d{1,3}%)/i);

  if (!match?.[1]) {
    return null;
  }

  const raw = match[1];
  if (raw.endsWith("%")) {
    return Number(raw.replace("%", "")) / 100;
  }

  return Number(raw);
}

function cleanupValue(value: string): string {
  return value.split("\n")[0].replace(/\s+/g, " ").trim().replace(/[.;]$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

