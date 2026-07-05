import { DashboardSummary, DocumentRecord, DocumentType, ValidationStatus, WarningCategory } from "./types";

export function buildDashboardSummary(records: DocumentRecord[]): DashboardSummary {
  const processed = records.filter((record) => record.status === "PROCESSED" && record.extraction);
  const totalPremium = processed.reduce((sum, record) => sum + (record.extraction?.premium ?? 0), 0);
  const totalConfidence = processed.reduce((sum, record) => sum + (record.extraction?.confidenceScore ?? 0), 0);
  const warnings = processed.flatMap((record) => record.extraction?.warnings ?? []);

  return {
    documentsProcessed: processed.length,
    totalPremium,
    averageConfidence: processed.length ? round(totalConfidence / processed.length) : 0,
    warningCount: warnings.length,
    premiumByLineOfBusiness: groupPremiumByLineOfBusiness(processed),
    documentsByStatus: groupDocumentsByStatus(processed),
    averageConfidenceByDocumentType: groupAverageConfidenceByDocumentType(processed),
    warningCountByCategory: groupWarningsByCategory(warnings.map((warning) => warning.category))
  };
}

function groupPremiumByLineOfBusiness(records: DocumentRecord[]) {
  const groups = new Map<string, { premium: number; documentCount: number }>();

  for (const record of records) {
    const lineOfBusiness = record.extraction?.lineOfBusiness ?? "Unknown";
    const current = groups.get(lineOfBusiness) ?? { premium: 0, documentCount: 0 };
    groups.set(lineOfBusiness, {
      premium: current.premium + (record.extraction?.premium ?? 0),
      documentCount: current.documentCount + 1
    });
  }

  return [...groups.entries()]
    .map(([lineOfBusiness, value]) => ({ lineOfBusiness, ...value }))
    .sort((a, b) => b.premium - a.premium);
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

