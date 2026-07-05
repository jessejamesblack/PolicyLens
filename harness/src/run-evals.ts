import {
  buildDashboardSummary,
  DocumentRecord,
  DocumentType,
  parseDriverLicenseText,
  validateStructuredExtraction,
  ValidationStatus,
  WarningCategory
} from "@driverslicense/domain";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface ExpectedFixture {
  documentType: DocumentType;
  expectedStatus: ValidationStatus;
  extraction: Record<string, unknown>;
  warningCategories: WarningCategory[];
}

interface EvalResult {
  slug: string;
  passed: boolean;
  status: ValidationStatus;
  expectedStatus: ValidationStatus;
  failures: string[];
}

const FIXTURES = [
  "ohio-real-id-front",
  "texas-under-21-front",
  "california-expired-front",
  "new-york-temporary-license",
  "florida-motorcycle-endorsement",
  "washington-license-back",
  "indiana-operator-license",
  "arizona-learner-permit",
  "colorado-missing-dob",
  "illinois-low-confidence",
  "georgia-missing-license-number"
];

export async function runEvalSuite(projectRoot = defaultProjectRoot()): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  const records: DocumentRecord[] = [];

  for (const slug of FIXTURES) {
    const expected = await readExpected(projectRoot, slug);
    const text = await readFile(join(projectRoot, "samples", "documents", `${slug}.txt`), "utf8");
    const extraction = parseDriverLicenseText({
      text,
      documentType: expected.documentType,
      referenceDate: "2026-07-04T00:00:00.000Z"
    });
    const validated = validateStructuredExtraction(extraction, "2026-07-04T00:00:00.000Z");
    const failures = compareExtraction(expected, validated);

    records.push({
      id: slug,
      filename: `${slug}.txt`,
      documentType: expected.documentType,
      contentType: "text/plain",
      storageKey: `${slug}.txt`,
      status: "PROCESSED",
      validationStatus: validated.status,
      extraction: validated.extraction,
      rawOcr: { adapter: "harness" },
      rawExtraction: extraction,
      errorMessage: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-07-01T00:00:00.000Z").toISOString()
    });

    results.push({
      slug,
      passed: failures.length === 0,
      status: validated.status,
      expectedStatus: expected.expectedStatus,
      failures
    });
  }

  const summary = buildDashboardSummary(records, "2026-07-04T00:00:00.000Z");
  if (summary.documentsProcessed !== 11) {
    results.push({
      slug: "dashboard-summary",
      passed: false,
      status: "FAILED",
      expectedStatus: "VALID",
      failures: [`Expected 11 processed documents, got ${summary.documentsProcessed}.`]
    });
  }

  if (summary.under21Count !== 2 || summary.expiredCount !== 2 || summary.realIdCount !== 5) {
    results.push({
      slug: "dashboard-license-facts",
      passed: false,
      status: "FAILED",
      expectedStatus: "VALID",
      failures: [
        `Expected under21=2 expired=2 realId=5, got under21=${summary.under21Count} expired=${summary.expiredCount} realId=${summary.realIdCount}.`
      ]
    });
  }

  return results;
}

async function readExpected(projectRoot: string, slug: string): Promise<ExpectedFixture> {
  const raw = await readFile(join(projectRoot, "samples", "expected", `${slug}.json`), "utf8");
  return JSON.parse(raw) as ExpectedFixture;
}

function compareExtraction(
  expected: ExpectedFixture,
  validated: ReturnType<typeof validateStructuredExtraction>
): string[] {
  const failures: string[] = [];

  if (validated.status !== expected.expectedStatus) {
    failures.push(`Expected status ${expected.expectedStatus}, got ${validated.status}.`);
  }

  for (const [field, expectedValue] of Object.entries(expected.extraction)) {
    const actualValue = validated.extraction[field as keyof typeof validated.extraction];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      failures.push(`Expected ${field} to be ${String(expectedValue)}, got ${String(actualValue)}.`);
    }
  }

  const actualWarningCategories = validated.warnings.map((warning) => warning.category).sort();
  const expectedWarningCategories = [...expected.warningCategories].sort();

  if (JSON.stringify(actualWarningCategories) !== JSON.stringify(expectedWarningCategories)) {
    failures.push(
      `Expected warnings ${expectedWarningCategories.join(",") || "none"}, got ${
        actualWarningCategories.join(",") || "none"
      }.`
    );
  }

  return failures;
}

function defaultProjectRoot(): string {
  return resolve(process.env.POLICYLENS_ROOT ?? process.env.INIT_CWD ?? join(process.cwd(), ".."));
}

async function main() {
  const results = await runEvalSuite();
  const failed = results.filter((result) => !result.passed);

  for (const result of results) {
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(`${marker} ${result.slug} status=${result.status} expected=${result.expectedStatus}`);

    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
