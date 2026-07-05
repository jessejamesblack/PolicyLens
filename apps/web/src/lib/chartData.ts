import type { ChartData } from "chart.js";
import type { DashboardSummary } from "@driverslicense/domain";

const palette = ["#117c73", "#3568a6", "#a66f00", "#6b7280", "#b23b3b"];

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function documentsByIssuingStateChart(summary: DashboardSummary): ChartData<"bar"> {
  return {
    labels: summary.documentsByIssuingState.map((item) => item.issuingState),
    datasets: [
      {
        label: "Documents",
        data: summary.documentsByIssuingState.map((item) => item.documentCount),
        backgroundColor: palette[0]
      }
    ]
  };
}

export function documentsByStatusChart(summary: DashboardSummary): ChartData<"doughnut"> {
  return {
    labels: summary.documentsByStatus.map((item) => item.status),
    datasets: [
      {
        label: "Documents",
        data: summary.documentsByStatus.map((item) => item.count),
        backgroundColor: palette
      }
    ]
  };
}

export function confidenceByDocumentTypeChart(summary: DashboardSummary): ChartData<"bar"> {
  return {
    labels: summary.averageConfidenceByDocumentType.map((item) => item.documentType),
    datasets: [
      {
        label: "Average confidence",
        data: summary.averageConfidenceByDocumentType.map((item) => item.averageConfidence),
        backgroundColor: palette[1]
      }
    ]
  };
}

export function expirationBucketChart(summary: DashboardSummary): ChartData<"bar"> {
  return {
    labels: summary.expirationBuckets.map((item) => item.bucket),
    datasets: [
      {
        label: "Documents",
        data: summary.expirationBuckets.map((item) => item.count),
        backgroundColor: palette[2]
      }
    ]
  };
}
