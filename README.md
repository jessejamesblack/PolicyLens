# DriversLicENSe

DriversLicENSe is a side project for playing with driver license OCR, structured extraction, validation, and analytics. It takes a license image, PDF, or camera photo, runs OCR, normalizes the fields into typed JSON, checks the result, and shows what needs a second look.

Live site: https://d3damhdwn1rquz.cloudfront.net

The sample set is synthetic only. Do not upload real identity documents, real customer data, or production PII.

Upload-ready synthetic examples live in `samples/upload-pdfs` and `samples/upload-images`.

## What It Scans

DriversLicENSe is tuned for driver license style documents:

- Front-side license scans with name, license number, issuing state, date of birth, issue date, expiration date, address, class, restrictions, endorsements, and physical descriptors.
- Back-side or barcode-text style scans where OCR can still expose normalized labels.
- Temporary licenses and learner permits with shorter expiration windows and extra restrictions.
- Quality edge cases such as missing DOB, missing license number, expired credentials, under-21 holders, and low OCR confidence.

General license facts modeled by the app:

- Issuing state matters because U.S. driver licenses are issued by states and territories, not one central national issuer.
- DOB is useful for age-at-scan, under-21 warnings, and age-bucket analytics.
- Expiration date drives validity warnings and operational expiration buckets.
- REAL ID, organ donor, veteran, restrictions, endorsements, class, sex, height, weight, eye color, and hair color are common fields or markers that can become useful structured data.
- Back-side scans often include machine-readable PDF417 data; this project parses AAMVA-style barcode payloads behind a dedicated adapter when that text is available.

## Architecture

```text
Upload
  -> SvelteKit UI
  -> NestJS API / API Gateway for small files
  -> presigned S3 browser upload for larger camera photos
  -> Local storage or S3
  -> Local queue or SQS with dead-letter handling
  -> Mock OCR or Amazon Textract
  -> AAMVA PDF417 barcode adapter
  -> Deterministic structured extraction
  -> Zod validation
  -> Redacted share-safe copy plus PII retention controls
  -> Local JSON store or DynamoDB
  -> Dashboard API
  -> SvelteKit dashboard
  -> Optional Snowflake analytics model
```

The important design choice is traceable persistence. DriversLicENSe stores normalized fields, schema version, confidence, warning metadata, barcode metadata, and redaction metadata together so failed, low-confidence, or surprising outputs can be replayed without losing context.

## Hosted AWS Version

The public site is hosted at https://d3damhdwn1rquz.cloudfront.net.

AWS resources used by the deployed MVP:

- CloudFront distributes the SvelteKit static site and routes API paths from the same public hostname.
- S3 stores the static web build and uploaded document objects.
- S3 presigned URLs let larger browser uploads avoid the API Gateway 10 MB request limit.
- API Gateway exposes the NestJS API over HTTP.
- Lambda runs the NestJS API bundle.
- SQS queues document processing jobs and sends exhausted retries to a dead-letter queue.
- DynamoDB stores document workflow records, processing job state, validation status, warnings, barcode metadata, redaction metadata, and normalized extraction fields.
- DynamoDB Streams are enabled so records can be shipped to Snowflake through a stream consumer or scheduled export.
- Textract performs OCR for uploaded images and small PDFs in deployed mode.
- IAM grants the Lambda least-path access to S3, DynamoDB, SQS, and Textract for this stack.
- GitHub Actions deploys the app through AWS OIDC using the repository secret `AWS_DEPLOY_ROLE_ARN`.
- API Gateway access logs write request status, route, latency, and integration errors to CloudWatch for edge failures that never reach Lambda.

The hosted site does not require visitors to have AWS credentials. Browser calls go through CloudFront to API Gateway.

## Frameworks And Why

- SvelteKit powers the UI because the app is small, fast, and dashboard-oriented.
- NestJS powers the API because controllers, services, dependency injection, and adapter boundaries stay explicit.
- TypeScript is used across the monorepo so domain contracts are shared by the API, UI, and harness.
- Zod validates extracted JSON at runtime and gives precise warning or failure reasons.
- AWS CDK defines the cloud stack as code and makes the deployment repeatable.
- Vitest covers domain rules, API orchestration, chart helpers, and harness behavior.
- Snowflake SQL models the analytics landing zone for downstream reporting.

## Monorepo Layout

```text
apps/web        SvelteKit upload, detail, and dashboard UI
apps/api        NestJS API, processing orchestration, and infrastructure adapters
packages/domain Shared types, schemas, parser, validation, and dashboard aggregation
harness         Golden fixture runner for extraction quality
infra/cdk       AWS CDK stack for hosted deployment
samples         Synthetic license text fixtures and expected JSON
snowflake       Warehouse schema and analytics queries
docs            Architecture, quality, deployment, and harness notes
```

## API

- `POST /documents/upload`
- `POST /documents/direct-upload`
- `POST /documents/:id/process`
- `GET /documents`
- `GET /documents/:id`
- `POST /documents/:id/adjudicate`
- `GET /dashboard/summary?issuingState=OH&documentType=LicenseFront&validationStatus=WARNING&expirationBucket=Expired`

## Local Setup

Use Node.js 22 or newer. On Windows, use `npm.cmd` because PowerShell may block the `npm` script shim.

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run build
npm.cmd run check:architecture
npm.cmd test
npm.cmd run harness
```

Run the backend:

```powershell
npm.cmd run dev:api
```

Run the frontend in a second terminal:

```powershell
npm.cmd run dev:web
```

The API runs on `http://localhost:3000`; the SvelteKit app runs on `http://127.0.0.1:5173`.

## Environment Defaults

```text
APP_MODE=local
OCR_ADAPTER=mock
EXTRACTION_ADAPTER=deterministic
STORAGE_ADAPTER=local
DB_ADAPTER=local
PROCESSING_QUEUE_ADAPTER=local
PROCESSING_MAX_ATTEMPTS=3
RETAIN_RAW_PII=false
RAW_PII_RETENTION_DAYS=7
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

AWS-only values:

```text
AWS_REGION=us-east-2
DOCUMENT_BUCKET_NAME=
DOCUMENT_TABLE_NAME=
PROCESSING_QUEUE_URL=
```

## Harness Engineering

DriversLicENSe uses harness engineering in the OpenAI sense: make the repository legible to coding agents, encode constraints in versioned files, and keep quality checks runnable from one command.

The harness checks:

- Golden synthetic license documents.
- Expected structured fields.
- Warning categories.
- Validation status.
- Dashboard aggregate stability.

Run it with:

```powershell
npm.cmd run harness
```

The broader verification loop is:

```powershell
npm.cmd run verify
```

## Snowflake Model

`snowflake/schema.sql` defines `DOCUMENT_EXTRACTIONS` with normalized license fields, schema version, field confidence, barcode metadata, redaction metadata, validation metadata, and extraction JSON. `snowflake/analytics.sql` includes queries for issuing-state volume, confidence, warning categories, expiration buckets, physical descriptor coverage, barcode coverage, low-confidence fields, privacy controls, and license facts such as REAL ID, organ donor, veteran, expired, and under-21 counts.

DynamoDB is useful for workflow state. Snowflake is the better fit for analytics, trend monitoring, and downstream reporting.

## Deployment

GitHub Actions deploys `main` through OIDC. Local deployment is also available with the `personal` AWS profile in `us-east-2`:

```powershell
$env:AWS_PROFILE = "personal"
$env:AWS_REGION = "us-east-2"
npm.cmd run cdk:synth
npm.cmd run deploy --workspace @driverslicense/cdk -- --require-approval never
```

CDK outputs:

- `WebsiteUrl`: public CloudFront URL.
- `ApiEndpoint`: direct API Gateway URL.

More details live in `docs/AWS_DEPLOYMENT.md`.

## Built-In Experiments

- AAMVA PDF417 barcode payload parsing behind a dedicated adapter.
- Direct-to-S3 browser uploads for larger phone camera photos.
- Share-safe redacted image artifacts plus stricter raw PII retention defaults.
- Async document processing with retry state and SQS dead-letter handling in AWS.
- Field-level confidence and manual adjudication for low-confidence values.
- Versioned extraction JSON with `driverslicense.extraction.v2`.
- Snowflake-shaped ingestion from DynamoDB Streams or scheduled exports.
- Dashboard filters by issuing state, document type, validation status, and expiration bucket.

DriversLicENSe is not a production identity verification system. It is a compact experimentation surface for OCR, extraction contracts, validation guardrails, cloud deployment, and harness-driven quality loops.
