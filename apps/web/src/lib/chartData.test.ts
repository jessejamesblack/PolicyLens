import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@driverslicense/domain";
import { documentsByIssuingStateChart, percent } from "./chartData";

describe("chartData", () => {
  it("formats metrics and builds stable chart labels", () => {
    const summary: DashboardSummary = {
      documentsProcessed: 1,
      averageConfidence: 0.91,
      warningCount: 0,
      realIdCount: 1,
      organDonorCount: 1,
      veteranCount: 0,
      expiredCount: 0,
      under21Count: 0,
      averageAge: 35,
      documentsByIssuingState: [{ issuingState: "OH", documentCount: 1 }],
      documentsByStatus: [{ status: "VALID", count: 1 }],
      averageConfidenceByDocumentType: [
        { documentType: "LicenseFront", averageConfidence: 0.91, documentCount: 1 }
      ],
      warningCountByCategory: [],
      expirationBuckets: [{ bucket: "Valid over 6 months", count: 1 }]
    };

    expect(percent(summary.averageConfidence)).toBe("91%");
    expect(documentsByIssuingStateChart(summary).labels).toEqual(["OH"]);
  });
});
