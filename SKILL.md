# DriversLicENSe Skill

Use this skill when working inside the DriversLicENSe repository.

## Project Shape

DriversLicENSe is a TypeScript monorepo for synthetic driver license OCR, structured extraction, validation, dashboarding, AWS deployment, and Snowflake-shaped analytics.

Core folders:

- `packages/domain`: types, Zod schemas, deterministic parser, validation, dashboard aggregation.
- `apps/api`: NestJS API, processing workflow, local adapters, AWS adapters.
- `apps/web`: SvelteKit upload, extraction detail, and dashboard UI.
- `harness`: golden synthetic license fixtures and expected JSON checks.
- `infra/cdk`: CloudFront, S3, Lambda, API Gateway, DynamoDB, and Textract infrastructure.
- `samples`: synthetic source documents only.
- `snowflake`: warehouse schema and analytics queries.
- `docs`: architecture, quality, deployment, and harness notes.

## Working Rules

- Keep local mode working without live credentials.
- Keep deployed mode working through AWS CDK and GitHub Actions.
- Preserve raw OCR and raw extraction JSON alongside normalized fields.
- Put shared business rules in `packages/domain`.
- Put adapter-specific code in `apps/api`.
- Put UI-only rendering in `apps/web`.
- Add or update a harness fixture when extraction behavior changes.
- Never add real identity documents or real PII.
- Avoid stale product framing in docs and samples.

## Commands

Use `npm.cmd` on Windows:

```powershell
npm.cmd install
npm.cmd run check:architecture
npm.cmd run build
npm.cmd test
npm.cmd run harness
npm.cmd run cdk:synth
npm.cmd run verify
```

## Change Checklist

- Domain contract changed: update `types.ts`, `schemas.ts`, validation tests, harness fixtures, API adapters, UI rendering, and Snowflake schema.
- Parser changed: update synthetic samples, expected JSON, parser tests, and harness totals.
- Dashboard changed: update `dashboard.ts`, chart helpers, dashboard UI, tests, and Snowflake analytics.
- Deployment changed: update `infra/cdk`, `.github/workflows`, and `docs/AWS_DEPLOYMENT.md`.
- Docs changed: run `npm.cmd run check:architecture`.
