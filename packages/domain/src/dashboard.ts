import {
  DashboardFilters,
  DashboardSummary,
  DocumentRecord,
  DocumentType,
  ValidationStatus,
  WarningCategory
} from "./types";

export function buildDashboardSummary(
  records: DocumentRecord[],
  referenceDate: Date | string = new Date(),
  filters: DashboardFilters = {}
): DashboardSummary {
  const reference = toDate(referenceDate);
  const processed = applyDashboardFilters(
    records.filter((record) => record.status === "PROCESSED" && record.extraction),
    filters,
    reference
  );
  const totalConfidence = processed.reduce((sum, record) => sum + (record.extraction?.confidenceScore ?? 0), 0);
  const warnings = processed.flatMap((record) => record.extraction?.warnings ?? []);
  const ages = processed
    .map((record) => record.extraction?.ageAtScan)
    .filter((age): age is number => typeof age === "number");

  return {
    documentsProcessed: processed.length,
    activeFilters: normalizeFilters(filters),
    averageConfidence: processed.length ? round(totalConfidence / processed.length) : 0,
    warningCount: warnings.length,
    realIdCount: processed.filter((record) => record.extraction?.realId === true).length,
    organDonorCount: processed.filter((record) => record.extraction?.organDonor === true).length,
    veteranCount: processed.filter((record) => record.extraction?.veteran === true).length,
    expiredCount: processed.filter((record) => record.extraction?.isExpired === true).length,
    under21Count: processed.filter((record) => (record.extraction?.ageAtScan ?? 99) < 21).length,
    averageAge: ages.length ? round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0,
    documentsByIssuingState: groupDocumentsByIssuingState(processed),
    documentsByStatus: groupDocumentsByStatus(processed),
    averageConfidenceByDocumentType: groupAverageConfidenceByDocumentType(processed),
    warningCountByCategory: groupWarningsByCategory(warnings.map((warning) => warning.category)),
    expirationBuckets: groupExpirationBuckets(processed, reference)
  };
}

export function getExpirationBucket(expirationDate: string | null, referenceDate: Date): string {
  if (!expirationDate) {
    return "Missing expiration";
  }

  const expiration = Date.parse(`${expirationDate}T00:00:00.000Z`);
  const current = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const daysUntilExpiration = Math.ceil((expiration - current) / 86_400_000);

  if (daysUntilExpiration < 0) {
    return "Expired";
  }

  if (daysUntilExpiration <= 30) {
    return "Expires within 30 days";
  }

  if (daysUntilExpiration <= 183) {
    return "Expires within 6 months";
  }

  return "Valid over 6 months";
}

function applyDashboardFilters(records: DocumentRecord[], filters: DashboardFilters, referenceDate: Date): DocumentRecord[] {
  const normalized = normalizeFilters(filters);

  return records.filter((record) => {
    if (normalized.issuingState && record.extraction?.issuingState !== normalized.issuingState) {
      return false;
    }

    if (normalized.documentType && record.documentType !== normalized.documentType) {
      return false;
    }

    if (normalized.validationStatus && record.validationStatus !== normalized.validationStatus) {
      return false;
    }

    if (
      normalized.expirationBucket &&
      getExpirationBucket(record.extraction?.expirationDate ?? null, referenceDate) !== normalized.expirationBucket
    ) {
      return false;
    }

    return true;
  });
}

function normalizeFilters(filters: DashboardFilters): DashboardFilters {
  return {
    issuingState: filters.issuingState?.toUpperCase() || null,
    documentType: filters.documentType || null,
    validationStatus: filters.validationStatus || null,
    expirationBucket: filters.expirationBucket || null
  };
}

function groupDocumentsByIssuingState(records: DocumentRecord[]) {
  const groups = new Map<string, number>();

  for (const record of records) {
    const issuingState = record.extraction?.issuingState ?? "Unknown";
    groups.set(issuingState, (groups.get(issuingState) ?? 0) + 1);
  }

  return [...groups.entries()]
    .map(([issuingState, documentCount]) => ({ issuingState, documentCount }))
    .sort((a, b) => b.documentCount - a.documentCount || a.issuingState.localeCompare(b.issuingState));
}

function groupDocumentsByStatus(records: DocumentRecord[]) {
  const groups = new Map<ValidationStatus, number>();

  for (const record of records) {
    const status = record.validationStatus ?? "FAILED";
    groups.set(status, (groups.get(status) ?? 0) + 1);
  }

  return [...groups.entries()].map(([status, count]) => ({ status, count }));
}

function groupAverageConfidenceByDocumentType(records: DocumentRecord[]) {
  const groups = new Map<DocumentType, { confidenceTotal: number; documentCount: number }>();

  for (const record of records) {
    const current = groups.get(record.documentType) ?? { confidenceTotal: 0, documentCount: 0 };
    groups.set(record.documentType, {
      confidenceTotal: current.confidenceTotal + (record.extraction?.confidenceScore ?? 0),
      documentCount: current.documentCount + 1
    });
  }

  return [...groups.entries()].map(([documentType, value]) => ({
    documentType,
    averageConfidence: value.documentCount ? round(value.confidenceTotal / value.documentCount) : 0,
    documentCount: value.documentCount
  }));
}

function groupWarningsByCategory(categories: WarningCategory[]) {
  const groups = new Map<WarningCategory, number>();

  for (const category of categories) {
    groups.set(category, (groups.get(category) ?? 0) + 1);
  }

  return [...groups.entries()].map(([category, count]) => ({ category, count }));
}

function groupExpirationBuckets(records: DocumentRecord[], referenceDate: Date) {
  const buckets = new Map<string, number>([
    ["Expired", 0],
    ["Expires within 30 days", 0],
    ["Expires within 6 months", 0],
    ["Valid over 6 months", 0],
    ["Missing expiration", 0]
  ]);

  for (const record of records) {
    const bucket = getExpirationBucket(record.extraction?.expirationDate ?? null, referenceDate);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .filter(([, count]) => count > 0)
    .map(([bucket, count]) => ({ bucket, count }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
