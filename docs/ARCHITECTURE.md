# Architecture

DriversLicENSe is organized as a TypeScript workspace with strict, predictable boundaries for synthetic driver license OCR, extraction, validation, and analytics.

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

- `packages/domain`: shared license types, Zod schemas, deterministic parsing, validation rules, and dashboard aggregation.
- `apps/api`: NestJS API, orchestration services, local adapters, and AWS adapters.
- `apps/web`: SvelteKit UI for upload, extraction detail, and dashboard views.
- `harness`: golden-fixture runner that validates extraction behavior end to end.
- `infra/cdk`: deployable AWS stack for Lambda, API Gateway, S3, DynamoDB, CloudFront, and Textract permissions.
- `snowflake`: warehouse DDL and analytics queries.

## Data Flow

```text
Upload
  -> DocumentStorageAdapter
  -> DocumentRepository
  -> DocumentOcrAdapter
  -> StructuredExtractionAdapter
  -> Zod validation
  -> raw plus normalized license DocumentRecord
  -> dashboard aggregation
```

## Boundary Rules

- `packages/domain` must not import NestJS, AWS SDK packages, SvelteKit, filesystem adapters, or app code.
- `apps/web` must not import `apps/api`, NestJS, AWS SDK packages, or Node-only infrastructure.
- `apps/api` may import `packages/domain`, but must not import Svelte routes or components.
- Infrastructure adapters must sit behind interfaces exported by `packages/domain`.
- Dashboard numbers should be derived from persisted `DocumentRecord` values, not duplicated UI logic.
