import {
  BarcodeResult,
  FieldConfidence,
  StructuredLicenseExtraction
} from "./types";

const AAMVA_CODES = new Set([
  "DAA",
  "DCS",
  "DAC",
  "DAD",
  "DCT",
  "DAQ",
  "DAJ",
  "DBB",
  "DBD",
  "DBA",
  "DAG",
  "DAI",
  "DAK",
  "DCA",
  "DCD",
  "DCB",
  "DBC",
  "DAU",
  "DAW",
  "DAY",
  "DAZ"
]);

export function parseAamvaPdf417Payload(payload: string): BarcodeResult {
  const normalizedPayload = payload.replace(/\r/g, "\n");
  const rawFields = parseAamvaFields(normalizedPayload);

  if (rawFields.size === 0) {
    return emptyBarcodeResult();
  }

  const firstName = rawFields.get("DAC") ?? rawFields.get("DCT") ?? null;
  const middleName = rawFields.get("DAD") ?? null;
  const lastName = rawFields.get("DCS") ?? null;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || rawFields.get("DAA") || null;

  return {
    format: "AAMVA_PDF417",
    rawText: payload,
    confidenceScore: 0.98,
    warnings: [],
    parsed: {
      fullName: normalizeNullable(fullName),
      licenseNumber: normalizeNullable(rawFields.get("DAQ")),
      issuingState: normalizeState(rawFields.get("DAJ")),
      dateOfBirth: normalizeAamvaDate(rawFields.get("DBB")),
      issueDate: normalizeAamvaDate(rawFields.get("DBD")),
      expirationDate: normalizeAamvaDate(rawFields.get("DBA")),
      address: normalizeAddress(rawFields),
      licenseClass: normalizeNullable(rawFields.get("DCA")),
      endorsements: splitBarcodeList(rawFields.get("DCD")),
      restrictions: splitBarcodeList(rawFields.get("DCB")),
      sex: normalizeSex(rawFields.get("DBC")),
      height: normalizeNullable(rawFields.get("DAU")),
      weight: normalizeNullable(rawFields.get("DAW")),
      eyeColor: normalizeNullable(rawFields.get("DAY")),
      hairColor: normalizeNullable(rawFields.get("DAZ"))
    }
  };
}

export function mergeBarcodeIntoExtraction(
  extraction: StructuredLicenseExtraction,
  barcodeResult: BarcodeResult | null | undefined
): StructuredLicenseExtraction {
  if (!barcodeResult?.parsed) {
    return extraction;
  }

  const barcode = barcodeResult.parsed;
  const merged: StructuredLicenseExtraction = {
    ...extraction,
    fullName: barcode.fullName ?? extraction.fullName,
    licenseNumber: barcode.licenseNumber ?? extraction.licenseNumber,
    issuingState: barcode.issuingState ?? extraction.issuingState,
    dateOfBirth: barcode.dateOfBirth ?? extraction.dateOfBirth,
    issueDate: barcode.issueDate ?? extraction.issueDate,
    expirationDate: barcode.expirationDate ?? extraction.expirationDate,
    address: barcode.address ?? extraction.address,
    licenseClass: barcode.licenseClass ?? extraction.licenseClass,
    endorsements: barcode.endorsements.length ? barcode.endorsements : extraction.endorsements,
    restrictions: barcode.restrictions.length ? barcode.restrictions : extraction.restrictions,
    sex: barcode.sex ?? extraction.sex,
    height: barcode.height ?? extraction.height,
    weight: barcode.weight ?? extraction.weight,
    eyeColor: barcode.eyeColor ?? extraction.eyeColor,
    hairColor: barcode.hairColor ?? extraction.hairColor
  };

  const barcodeFields = new Set(
    Object.entries(barcode)
      .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null))
      .map(([field]) => field)
  );

  return {
    ...merged,
    fieldConfidences: merged.fieldConfidences.map((confidence) =>
      barcodeFields.has(confidence.field)
        ? boostBarcodeConfidence(confidence, barcodeResult.confidenceScore)
        : confidence
    )
  };
}

export function emptyBarcodeResult(): BarcodeResult {
  return {
    format: "NONE",
    parsed: null,
    rawText: null,
    confidenceScore: 0,
    warnings: []
  };
}

function parseAamvaFields(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  const lines = payload
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const directCode = line.match(/^([A-Z]{3})(.+)$/);
    if (directCode?.[1] && AAMVA_CODES.has(directCode[1])) {
      fields.set(directCode[1], directCode[2].trim());
      continue;
    }

    for (const code of AAMVA_CODES) {
      const index = line.indexOf(code);
      if (index >= 0 && index + 3 < line.length) {
        fields.set(code, line.slice(index + 3).trim());
        break;
      }
    }
  }

  return fields;
}

function normalizeAamvaDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    const [, month, day, year] = compact;
    return `${year}-${month}-${day}`;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return trimmed;
  }

  return null;
}

function normalizeAddress(fields: Map<string, string>): string | null {
  const street = normalizeNullable(fields.get("DAG"));
  const city = normalizeNullable(fields.get("DAI"));
  const state = normalizeState(fields.get("DAJ"));
  const postal = normalizeNullable(fields.get("DAK"))?.slice(0, 10) ?? null;
  const cityLine = [city, state].filter(Boolean).join(", ");
  const postalLine = [cityLine, postal].filter(Boolean).join(" ");

  return [street, postalLine].filter(Boolean).join(", ") || null;
}

function normalizeState(value: string | undefined): string | null {
  const match = value?.toUpperCase().match(/\b[A-Z]{2}\b/);
  return match?.[0] ?? null;
}

function normalizeSex(value: string | undefined): string | null {
  if (value === "1") {
    return "M";
  }

  if (value === "2") {
    return "F";
  }

  return normalizeNullable(value);
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function splitBarcodeList(value: string | undefined): string[] {
  if (!value || /^none$/i.test(value)) {
    return [];
  }

  return value
    .split(/[,;/| ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function boostBarcodeConfidence(confidence: FieldConfidence, barcodeConfidence: number): FieldConfidence {
  return {
    ...confidence,
    confidence: Math.max(confidence.confidence, barcodeConfidence),
    source: "barcode",
    needsAdjudication: barcodeConfidence < 0.75
  };
}
