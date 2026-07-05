import {
  DocumentType,
  EXTRACTION_SCHEMA_VERSION,
  FieldConfidence,
  LICENSE_FIELD_NAMES,
  LicenseFieldName,
  OcrResult,
  StructuredLicenseExtraction
} from "./types";

export function parseDriverLicenseText(input: {
  text: string;
  documentType: DocumentType;
  ocrResult?: OcrResult;
  referenceDate?: Date | string;
}): StructuredLicenseExtraction {
  const text = normalizeWhitespace(input.text);
  const dates = findAllNormalizedDates(text);
  const fullName = findFullName(text);
  const licenseNumber = findLicenseNumber(text);
  const issuingState =
    normalizeState(findString(text, ["Issuing State", "State", "Jurisdiction"])) ??
    inferStateFromText(text) ??
    inferStateFromLicenseNumber(licenseNumber);
  const dateOfBirth =
    normalizeDate(findString(text, ["Date of Birth", "DOB", "Birth Date"])) ??
    findDateNearLabel(text, ["Date of Birth", "Birth Date", "3 DOB", "DOB"]);
  const under21Until =
    normalizeDate(findString(text, ["Under 21 Until", "Under 21", "Turns 21"])) ??
    findDateNearLabel(text, ["Under 21 Until", "Under 21", "Turns 21"]);
  const expirationDate =
    normalizeDate(findString(text, ["Expiration Date", "Expires", "EXP"])) ??
    findDateNearLabel(text, ["Expiration Date", "Expiration", "Expires", "4b Exp", "EXP"]) ??
    inferExpirationDate(dates, dateOfBirth, under21Until);
  const issueDate =
    normalizeDate(findString(text, ["Issue Date", "Issued", "ISS", "Issue"])) ??
    findDateOnLabelLine(text, ["Issue Date", "Issued", "4a Iss", "ISS", "Issue"]) ??
    inferIssueDate(dates, dateOfBirth, expirationDate, under21Until);
  const address = findString(text, ["Address", "Residence Address", "Street Address"]) ?? findDmvAddress(text);
  const licenseClass = findString(text, ["License Class", "Class"]) ?? findDmvCodeValue(text, ["9 Class"]);
  const endorsements = findList(text, ["Endorsements", "Endorsement"]);
  const dmvEndorsements = findDmvCodeList(text, ["9a End", "9a Endorsement", "9a Endorsements"]);
  const restrictions = findList(text, ["Restrictions", "Restriction"]);
  const dmvRestrictions = findDmvCodeList(text, ["12 Res", "12 Restriction", "12 Restrictions"]);
  const sex = findString(text, ["Sex", "Gender"]) ?? findDmvCodeValue(text, ["15 Sex"]);
  const height = findString(text, ["Height", "HGT"]) ?? findDmvCodeValue(text, ["16 Hgt", "16 Height"]);
  const weight = findString(text, ["Weight", "WGT"]) ?? findDmvCodeValue(text, ["17 Wgt", "17 Weight"]);
  const eyeColor = findString(text, ["Eye Color", "Eyes", "EYE"]) ?? findDmvCodeValue(text, ["18 Eyes", "18 Eye"]);
  const hairColor = findString(text, ["Hair Color", "Hair"]) ?? findDmvCodeValue(text, ["19 Hair"]);
  const organDonor = findBoolean(text, ["Organ Donor", "Donor"]) ?? inferOrganDonor(text);
  const veteran = findBoolean(text, ["Veteran"]);
  const realId = findBoolean(text, ["REAL ID", "Real ID", "Real ID Compliant"]) ?? inferRealId(text);
  const referenceDate = toDate(input.referenceDate ?? new Date());
  const ageAtScan = dateOfBirth ? calculateAge(dateOfBirth, referenceDate) : null;
  const isExpired = expirationDate ? isBefore(expirationDate, referenceDate) : false;
  const confidenceScore = findConfidence(text) ?? input.ocrResult?.confidenceScore ?? 0.86;

  const extraction = {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    fullName,
    licenseNumber,
    issuingState,
    dateOfBirth,
    issueDate,
    expirationDate,
    address,
    licenseClass,
    endorsements: endorsements.length ? endorsements : dmvEndorsements,
    restrictions: restrictions.length ? restrictions : dmvRestrictions,
    sex,
    height,
    weight,
    eyeColor,
    hairColor,
    organDonor,
    veteran,
    realId,
    under21Until,
    ageAtScan,
    isExpired,
    confidenceScore,
    fieldConfidences: [],
    warnings: []
  };

  return {
    ...extraction,
    fieldConfidences: buildFieldConfidences(extraction, confidenceScore)
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function findString(text: string, labels: string[]): string | null {
  const lines = text.split("\n");

  for (const label of labels) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*(?::|-|\\s{2,})\\s*(.+)$`, "i");

    for (const line of lines) {
      const match = line.match(pattern);

      if (match?.[1]) {
        return cleanupValue(match[1]);
      }
    }
  }

  return null;
}

function findFullName(text: string): string | null {
  const direct = findString(text, ["Full Name", "Name", "Cardholder", "Driver"]);
  if (direct) {
    return direct;
  }

  const standalone = findValueAfterStandaloneLabel(text, ["Full Name", "Name", "Cardholder"], isLikelyName);
  if (standalone) {
    return standalone;
  }

  const firstName = findString(text, ["First Name", "Given Name"]);
  const lastName = findString(text, ["Last Name", "Family Name", "Surname"]);

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  const dmvName = findDmvCodedName(text);
  if (dmvName) {
    return dmvName;
  }

  const standaloneName = findStandaloneName(text);
  if (standaloneName) {
    return standaloneName;
  }

  return text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+ Sample\b/)?.[0] ?? null;
}

function findLicenseNumber(text: string): string | null {
  return (
    findString(text, ["License Number", "DL Number", "Driver License Number", "Document Number", "ID Number"]) ??
    findDmvLicenseNumber(text) ??
    text.match(/\b[A-Z]{1,3}[0-9]{5,12}\b/)?.[0] ??
    null
  );
}

function normalizeState(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.toUpperCase().match(/\b[A-Z]{2}\b/);
  if (match?.[0] && STATE_CODES.has(match[0])) {
    return match[0];
  }

  return findStateName(value);
}

function inferStateFromLicenseNumber(licenseNumber: string | null): string | null {
  if (!licenseNumber) {
    return null;
  }

  return licenseNumber.match(/^[A-Z]{2}/)?.[0] ?? null;
}

function inferStateFromText(text: string): string | null {
  for (const line of text.split("\n")) {
    const stateName = findStateName(line);
    if (stateName) {
      return stateName;
    }

    const addressState = line.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
    if (addressState?.[1] && STATE_CODES.has(addressState[1])) {
      return addressState[1];
    }

    const compactState = line.match(/\b([A-Z]{2})\s+USA\b/);
    if (compactState?.[1] && STATE_CODES.has(compactState[1])) {
      return compactState[1];
    }
  }

  return null;
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

function findAllNormalizedDates(text: string): string[] {
  const dates = new Set<string>();
  const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/g;

  for (const match of text.matchAll(datePattern)) {
    const normalized = normalizeDate(match[1]);
    if (normalized) {
      dates.add(normalized);
    }
  }

  return [...dates].sort();
}

function findDateNearLabel(text: string, labels: string[]): string | null {
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizeLabel(lines[index]);

    if (!labels.some((label) => normalizedLine.includes(normalizeLabel(label)))) {
      continue;
    }

    const sameLineDate = firstDateAfterAnyLabel(lines[index], labels) ?? firstDateIn(lines[index]);
    if (sameLineDate) {
      return sameLineDate;
    }

    for (const nearbyLine of lines.slice(index + 1, index + 5)) {
      const nearbyDate = firstDateIn(nearbyLine);
      if (nearbyDate) {
        return nearbyDate;
      }
    }
  }

  return null;
}

function findDateOnLabelLine(text: string, labels: string[]): string | null {
  const lines = text.split("\n");

  for (const line of lines) {
    const normalizedLine = normalizeLabel(line);

    if (!labels.some((label) => normalizedLine.includes(normalizeLabel(label)))) {
      continue;
    }

    const sameLineDate = firstDateAfterAnyLabel(line, labels);
    if (sameLineDate) {
      return sameLineDate;
    }
  }

  return null;
}

function firstDateIn(value: string): string | null {
  const match = value.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/);
  return match?.[1] ? normalizeDate(match[1]) : null;
}

function firstDateAfterAnyLabel(value: string, labels: string[]): string | null {
  for (const label of labels) {
    const labelPattern = labelToPattern(label);
    const pattern = new RegExp(
      `(?:^|[^A-Za-z0-9])${labelPattern}\\s*(?:Date)?\\s*(?::|-)?\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}\\/\\d{4})`,
      "i"
    );
    const match = value.match(pattern);

    if (match?.[1]) {
      return normalizeDate(match[1]);
    }
  }

  return null;
}

function inferExpirationDate(dates: string[], dateOfBirth: string | null, under21Until: string | null): string | null {
  const remainingDates = dates.filter((date) => date !== dateOfBirth && date !== under21Until);
  return remainingDates.at(-1) ?? null;
}

function inferIssueDate(
  dates: string[],
  dateOfBirth: string | null,
  expirationDate: string | null,
  under21Until: string | null
): string | null {
  return dates.find((date) => date !== dateOfBirth && date !== expirationDate && date !== under21Until) ?? null;
}

function findList(text: string, labels: string[]): string[] {
  const value = findString(text, labels);
  if (!value || /^(none|n\/a|not applicable)$/i.test(value)) {
    return [];
  }

  return value
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findDmvCodeList(text: string, labels: string[]): string[] {
  const value = findDmvCodeValue(text, labels);
  if (!value || /^(none|n\/a|not applicable)$/i.test(value)) {
    return [];
  }

  return value
    .split(/[,;/| ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findBoolean(text: string, labels: string[]): boolean | null {
  const value = findString(text, labels) ?? findValueAfterStandaloneLabel(text, labels, isBooleanLike);
  if (!value) {
    return null;
  }

  if (/^(yes|y|true|1|present|compliant|star)$/i.test(value)) {
    return true;
  }

  if (/^(no|n|false|0|absent|non-compliant|not compliant|none)$/i.test(value)) {
    return false;
  }

  return null;
}

function inferRealId(text: string): boolean | null {
  if (/\bREAL ID\b/i.test(text) && /\b(star|compliant|yes)\b/i.test(text)) {
    return true;
  }

  return null;
}

function inferOrganDonor(text: string): boolean | null {
  return text
    .split("\n")
    .some((line) => /^DONOR\b/i.test(cleanupValue(line)) || /\bORGAN DONOR\b/i.test(line))
    ? true
    : null;
}

function findConfidence(text: string): number | null {
  const match = text.match(/Confidence\s*[:\-]\s*(0?\.\d+|1(?:\.0)?|\d{1,3}%)/i);
  const standalone = findValueAfterStandaloneLabel(text, ["Confidence"], isConfidenceLike);

  if (!match?.[1] && !standalone) {
    return null;
  }

  const raw = match?.[1] ?? standalone ?? "";
  if (raw.endsWith("%")) {
    return Number(raw.replace("%", "")) / 100;
  }

  return Number(raw);
}

function cleanupValue(value: string): string {
  return value.split("\n")[0].replace(/\s+/g, " ").trim().replace(/[.;]$/, "");
}

function findDmvLicenseNumber(text: string): string | null {
  for (const line of text.split("\n")) {
    const match = line.match(/\b(?:4d\s+)?DLN\s+([A-Z0-9][A-Z0-9-]{3,})\b/i);
    if (match?.[1]) {
      return cleanupValue(match[1]).toUpperCase();
    }
  }

  return null;
}

function findDmvCodedName(text: string): string | null {
  const lines = text.split("\n").map(cleanupValue).filter(Boolean);
  const familyName = findLineCodeValue(lines, "1");
  const givenName = findLineCodeValue(lines, "2");

  if (familyName && givenName && isLikelyPersonNamePart(familyName) && isLikelyPersonNamePart(givenName)) {
    return `${toPersonCase(givenName)} ${toPersonCase(familyName)}`;
  }

  return null;
}

function findStandaloneName(text: string): string | null {
  for (const line of text.split("\n").map(cleanupValue).filter(Boolean)) {
    if (isNoiseOrLabel(line)) {
      continue;
    }

    if (/[a-z]/.test(line) && isLikelyName(line)) {
      return line;
    }
  }

  return null;
}

function findLineCodeValue(lines: string[], code: string): string | null {
  const pattern = new RegExp(`^${escapeRegExp(code)}\\s+(.+)$`, "i");

  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return cleanupDmvValue(match[1]);
    }
  }

  return null;
}

function findDmvCodeValue(text: string, labels: string[]): string | null {
  for (const line of text.split("\n").map(cleanupValue).filter(Boolean)) {
    for (const label of labels) {
      const labelPattern = labelToPattern(label);
      const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${labelPattern}\\s+(.+)$`, "i");
      const match = line.match(pattern);

      if (match?.[1]) {
        return cleanupDmvValue(match[1]);
      }
    }
  }

  return null;
}

function findDmvAddress(text: string): string | null {
  const lines = text.split("\n").map(cleanupValue).filter(Boolean);
  const addressParts: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const firstPart = lines[index].match(/^8\s+(.+)$/i)?.[1];
    if (!firstPart) {
      continue;
    }

    addressParts.push(cleanupDmvValue(firstPart));

    for (const line of lines.slice(index + 1)) {
      if (isDmvFieldLine(line) || isNoiseOrLabel(line)) {
        break;
      }

      if (looksLikeAddressLine(line)) {
        addressParts.push(cleanupDmvValue(line));
      }
    }

    break;
  }

  if (addressParts.length === 0) {
    return null;
  }

  return addressParts.map(formatAddressPart).join(", ");
}

function isDmvFieldLine(value: string): boolean {
  return /^(?:1|2|3|4a|4b|4d|5|9|9a|12|15|16|17|18|19)\b/i.test(value);
}

function looksLikeAddressLine(value: string): boolean {
  return (
    /\b(?:APT|STE|UNIT|PO BOX|DRIVE|DR|STREET|ST|ROAD|RD|LANE|LN|AVE|AVENUE|BLVD|WAY|COURT|CT)\b/i.test(value) ||
    /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(value)
  );
}

function cleanupDmvValue(value: string): string {
  return cleanupValue(value).replace(/^(?:DLN|Iss|Exp|DOB|Class|End|Res|Sex|Hgt|Wgt|Eyes|Hair)\s+/i, "");
}

function formatAddressPart(value: string): string {
  if (/,/.test(value)) {
    return value.replace(/^([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i, (_match, city, state, postal) => {
      const stateCode = String(state).toUpperCase();
      return `${toTitleCase(city)}, ${stateCode} ${postal}`;
    });
  }

  return toTitleCase(value);
}

function findValueAfterStandaloneLabel(
  text: string,
  labels: string[],
  predicate: (value: string) => boolean
): string | null {
  const lines = text.split("\n").map(cleanupValue).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const current = normalizeLabel(lines[index]);
    const isLabel = labels.some((label) => current === normalizeLabel(label));

    if (!isLabel) {
      continue;
    }

    for (const option of lines.slice(index + 1, index + 6)) {
      if (isNoiseOrLabel(option)) {
        continue;
      }

      if (predicate(option)) {
        return option;
      }
    }
  }

  return null;
}

function isLikelyName(value: string): boolean {
  return /^[A-Z][A-Za-z'-]+ [A-Z][A-Za-z'-]+(?: [A-Z][A-Za-z'-]+)?$/.test(value);
}

function isLikelyPersonNamePart(value: string): boolean {
  return /^[A-Za-z][A-Za-z'-]+$/.test(value) && !isNoiseOrLabel(value);
}

function isBooleanLike(value: string): boolean {
  return /^(yes|y|true|1|present|compliant|star|no|n|false|0|absent|non-compliant|not compliant|none)$/i.test(value);
}

function isConfidenceLike(value: string): boolean {
  return /^(0?\.\d+|1(?:\.0)?|\d{1,3}%)$/i.test(value);
}

function isNoiseOrLabel(value: string): boolean {
  const normalized = normalizeLabel(value);
  const knownLabels = new Set([
    "ADDRESS",
    "CLASS",
    "CONFIDENCE",
    "DATE",
    "DATE OF BIRTH",
    "DOB",
    "ENDORSEMENTS",
    "EXPIRATION",
    "EXPIRATION DATE",
    "EYE COLOR",
    "FULL NAME",
    "HEIGHT",
    "ISSUE",
    "ISSUE DATE",
    "ISSUING STATE",
    "LICENSE CLASS",
    "LICENSE NUMBER",
    "NO PHOTO",
    "OCR TEST ONLY",
    "ORGAN DONOR",
    "REAL ID",
    "RESTRICTIONS",
    "SEX",
    "VETERAN"
  ]);

  return knownLabels.has(normalized) || normalized.includes("SYNTHETIC") || normalized.includes("GOVERNMENT ID");
}

function normalizeLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
}

function toPersonCase(value: string): string {
  return value
    .toLowerCase()
    .split(/([ '-])/)
    .map((part) => (/^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join("");
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => {
      if (/^(apt|ste|unit|po|box)$/i.test(part)) {
        return part.toUpperCase();
      }

      if (/^[a-z]/.test(part)) {
        return part[0].toUpperCase() + part.slice(1);
      }

      return part;
    })
    .join(" ");
}

function calculateAge(dateOfBirth: string, referenceDate: Date): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  let age = referenceDate.getUTCFullYear() - birthYear;
  const currentMonth = referenceDate.getUTCMonth() + 1;
  const currentDay = referenceDate.getUTCDate();

  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  return age;
}

function isBefore(dateValue: string, referenceDate: Date): boolean {
  return Date.parse(`${dateValue}T00:00:00.000Z`) < Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelToPattern(value: string): string {
  return escapeRegExp(value).replace(/\s+/g, "[^A-Za-z0-9]+");
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY"
};

const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

function findStateName(value: string): string | null {
  const normalized = normalizeLabel(value);

  for (const [stateName, stateCode] of Object.entries(STATE_NAME_TO_CODE)) {
    if (new RegExp(`\\b${escapeRegExp(stateName)}\\b`).test(normalized)) {
      return stateCode;
    }
  }

  return null;
}

function buildFieldConfidences(
  extraction: Omit<StructuredLicenseExtraction, "fieldConfidences">,
  defaultConfidence: number
): FieldConfidence[] {
  return LICENSE_FIELD_NAMES.map((field) => {
    const value = extraction[field];
    const present = Array.isArray(value) ? value.length > 0 : value !== null;
    const confidence = present ? inferFieldConfidence(field, defaultConfidence) : Math.min(defaultConfidence, 0.45);

    return {
      field,
      confidence,
      source: present ? inferFieldSource(field) : "parser",
      needsAdjudication: present && confidence < 0.75
    };
  });
}

function inferFieldConfidence(field: LicenseFieldName, defaultConfidence: number): number {
  if (field === "isExpired" || field === "ageAtScan") {
    return Math.max(0.8, defaultConfidence);
  }

  if (field === "realId" || field === "organDonor" || field === "veteran") {
    return Math.min(defaultConfidence, 0.86);
  }

  return defaultConfidence;
}

function inferFieldSource(field: LicenseFieldName): FieldConfidence["source"] {
  return field === "isExpired" || field === "ageAtScan" ? "parser" : "ocr";
}
