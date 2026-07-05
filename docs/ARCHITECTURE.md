# Architecture

DriversLicENSe is organized as a TypeScript workspace with strict, predictable boundaries for driver license OCR, barcode parsing, extraction, validation, privacy controls, and analytics.

```text
samples
  -> harness
  -> packages/domain
  -> apps/api
  -> apps/web
  -> infra/cdk
  -> snowflake
```

## Packages

- `packages/domain`: shared license types, Zod schemas, deterministic parsing, AAMVA barcode helpers, validation rules, dashboard filtering, and dashboard aggregation.
- `apps/api`: NestJS API, orchestration services, local adapters, AWS adapters, redaction adapters, and processing queue adapters.
- `apps/web`: SvelteKit UI for upload, extraction detail, and dashboard views.
- `harness`: golden-fixture runner that validates extraction behavior end to end.
- `infra/cdk`: deployable AWS stack for Lambda, API Gateway, S3, DynamoDB, CloudFront, and Textract permissions.
- `snowflake`: warehouse DDL and analytics queries.

## Data Flow

```text
Upload
  -> DocumentStorageAdapter
  -> DocumentRepository
  -> DocumentProcessingQueue
  -> DocumentOcrAdapter
  -> DocumentBarcodeAdapter
  -> StructuredExtractionAdapter
  -> Zod validation
  -> DocumentRedactionAdapter
  -> versioned raw plus normalized license DocumentRecord
  -> dashboard aggregation
```

## Boundary Rules

- `packages/domain` must not import NestJS, AWS SDK packages, SvelteKit, filesystem adapters, or app code.
- `apps/web` must not import `apps/api`, NestJS, AWS SDK packages, or Node-only infrastructure.
- `apps/api` may import `packages/domain`, but must not import Svelte routes or components.
- Infrastructure adapters must sit behind interfaces exported by `packages/domain`.
- Dashboard numbers should be derived from persisted `DocumentRecord` values, not duplicated UI logic.
- Barcode parsing, queueing, and redaction must stay behind adapters so local mode remains credential-free.
- Extraction JSON must include a schema version and field-level confidence metadata.
