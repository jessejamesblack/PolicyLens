# Snowflake Model

The local app uses local JSON persistence by default and can use DynamoDB in AWS mode. Snowflake is modeled as the analytics landing zone for normalized driver license extraction fields, field confidence, barcode metadata, redaction metadata, and raw JSON.

The warehouse table keeps both shapes:

- Normalized columns support dashboard queries, issuing-state reporting, expiration monitoring, and operational filters.
- `extracted_json` preserves extraction output for auditability and replay.
- `validation_warnings` preserves data quality metadata for monitoring.
- `field_confidences` tracks values that need manual adjudication.
- `barcode_json` tracks AAMVA PDF417 parsing coverage.
- `redaction_json` and `pii_retention` track privacy controls without exposing protected values.

## Ingestion Paths

The CDK stack enables DynamoDB Streams on the document table. A production ingestion path can attach a small stream consumer that writes `NEW_IMAGE` records to an S3 stage as newline-delimited JSON for Snowpipe.

A simpler batch path is a scheduled export: scan records updated since the last watermark, write normalized rows to S3, and let Snowflake load from the stage on a schedule. That path is slower but easier to reason about for a side project.

Use `schema.sql` to create the table and `analytics.sql` for example reporting queries.
