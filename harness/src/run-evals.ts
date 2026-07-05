import {
  buildDashboardSummary,
  DocumentRecord,
  DocumentType,
  parseInsuranceDocumentText,
  validateStructuredExtraction,
  ValidationStatus,
  WarningCategory
} from "@policylens/domain";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface ExpectedFixture {
  documentType: DocumentType;
  expectedStatus: ValidationStatus;
  extraction: Record<string, string | number | null>;
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
  "general-liability-policy",
  "property-submission",
  "commercial-auto-policy",
  "cyber-submission-missing-policy",
  "workers-comp-low-confidence"
];

export async function runEvalSuite(projectRoot = defaultProjectRoot()): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  const records: DocumentRecord[] = [];

  for (const slug of FIXTURES) {
    const expected = await readExpected(projectRoot, slug);
    const text = await readFile(join(projectRoot, "samples", "documents", `${slug}.txt`), "utf8");
    const extraction = parseInsuranceDocumentText({
      text,
      documentType: expected.documentType
    });
    const validated = validateStructuredExtraction(extraction);
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

  const summary = buildDashboardSummary(records);
  if (summary.documentsProcessed !== 5) {
    results.push({
      slug: "dashboard-summary",
      passed: false,
      status: "FAILED",
      expectedStatus: "VALID",
      failures: [`Expected 5 processed documents, got ${summary.documentsProcessed}.`]
    });
  }

  if (summary.totalPremium !== 842000) {
    results.push({
      slug: "dashboard-premium",
      passed: false,
      status: "FAILED",
      expectedStatus: "VALID",
      failures: [`Expected total premium 842000, got ${summary.totalPremium}.`]
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

    if (actualValue !== expectedValue) {
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

