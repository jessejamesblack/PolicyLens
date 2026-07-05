import {
  DocumentRedactionAdapter,
  LicenseFieldName,
  RedactDocumentInput
} from "@driverslicense/domain";

export class ShareSafeRedactionAdapter implements DocumentRedactionAdapter {
  async redact(input: RedactDocumentInput) {
    const redactedFields = findRedactedFields(input);
    const safeText = buildRedactedText(input, redactedFields);

    return {
      filename: `${stripExtension(input.filename)}.redacted.svg`,
      contentType: "image/svg+xml",
      bytes: Buffer.from(renderRedactedSvg(input.filename, safeText, redactedFields), "utf8"),
      redactedFields,
      notes: [
        "Generated a share-safe redacted image artifact.",
        "Original uploads are controlled by the configured retention policy."
      ]
    };
  }
}

export function redactRawPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactRawPayload(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactRawPayload(item)]));
  }

  return value;
}

function findRedactedFields(input: RedactDocumentInput): LicenseFieldName[] {
  const fields: LicenseFieldName[] = [];
  const extraction = input.extraction;

  for (const field of ["fullName", "licenseNumber", "dateOfBirth", "address"] as const) {
    if (extraction[field]) {
      fields.push(field);
    }
  }

  return fields;
}

function buildRedactedText(input: RedactDocumentInput, redactedFields: LicenseFieldName[]): string[] {
  const extraction = input.extraction;
  const rows = [
    `File: ${input.filename}`,
    `State: ${extraction.issuingState ?? "Unknown"}`,
    `Document type: license scan`,
    `Expiration: ${extraction.expirationDate ?? "Unknown"}`,
    `Class: ${extraction.licenseClass ?? "Unknown"}`
  ];

  if (redactedFields.length) {
    rows.push(`Redacted: ${redactedFields.join(", ")}`);
  }

  return rows;
}

function renderRedactedSvg(filename: string, rows: string[], redactedFields: LicenseFieldName[]): string {
  const escapedRows = rows.map(escapeXml);
  const fieldCount = Math.max(redactedFields.length, 3);
  const blocks = Array.from({ length: fieldCount }, (_value, index) => {
    const y = 76 + index * 26;
    return `<rect x="28" y="${y}" width="${index % 2 === 0 ? 296 : 226}" height="13" rx="4" fill="#111827" opacity="0.9" />`;
  }).join("");
  const textRows = escapedRows
    .map((row, index) => `<text x="28" y="${190 + index * 21}" fill="#1f2937" font-size="14">${row}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="360" viewBox="0 0 760 360" role="img" aria-label="Redacted copy of ${escapeXml(filename)}">
  <rect width="760" height="360" rx="24" fill="#f8fafc"/>
  <rect x="18" y="18" width="724" height="324" rx="18" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="28" y="52" fill="#0f172a" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">Redacted license copy</text>
  <text x="28" y="322" fill="#64748b" font-family="Inter, Arial, sans-serif" font-size="13">DriversLicENSe keeps this preview separate from the protected upload.</text>
  ${blocks}
  <g font-family="Inter, Arial, sans-serif">${textRows}</g>
</svg>`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b[A-Z]{1,3}[0-9][A-Z0-9-]{4,}\b/g, "[REDACTED_LICENSE]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, "[REDACTED_DATE]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[REDACTED_DATE]")
    .replace(/\b\d{1,6}\s+[A-Za-z0-9 .'-]+\s+(?:DRIVE|DR|STREET|ST|ROAD|RD|LANE|LN|AVE|AVENUE|BLVD|WAY|COURT|CT)\b/gi, "[REDACTED_ADDRESS]");
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || "document";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
