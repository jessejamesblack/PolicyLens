# Quality Loop

Run these checks before merging substantial changes:

```powershell
npm.cmd run check:architecture
npm.cmd run build
npm.cmd test
npm.cmd run harness
npm.cmd run cdk:synth
```

## What The Checks Cover

- `check:architecture`: required docs, forbidden project-framing language, and cross-layer dependency boundaries.
- `build`: TypeScript, NestJS, SvelteKit, CDK, and harness compilation.
- `test`: unit and smoke tests for validation, parsing, barcode parsing, API orchestration, frontend chart helpers, and eval runner behavior.
- `harness`: golden synthetic license documents, expected structured fields, validation statuses, warning categories, schema-versioned output, and aggregate dashboard totals.
- `cdk:synth`: AWS infrastructure shape including HTTP, S3, DynamoDB Streams, SQS retry/DLQ, Lambda, CloudFront, and Textract permissions without creating cloud resources.

## When To Add Coverage

- Add a golden sample when parser or validation behavior changes.
- Add a unit test when a validation rule, dashboard aggregate, or adapter contract changes.
- Add a unit test when barcode parsing, redaction, queue behavior, field confidence, or dashboard filters change.
- Add a docs update when commands, architecture, adapters, or environment variables change.
- Add an architecture check when a boundary rule becomes important enough to enforce mechanically.
