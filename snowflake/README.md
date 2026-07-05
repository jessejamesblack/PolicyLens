# Snowflake Model

The local app uses local JSON persistence by default and can use DynamoDB in AWS mode. Snowflake is modeled as the analytics landing zone for normalized extraction fields plus raw JSON.

The warehouse table keeps both shapes:

- Normalized columns support dashboard queries, portfolio reporting, and operational filters.
- `extracted_json` preserves raw model output for auditability and replay.
- `validation_warnings` preserves data quality metadata for monitoring.

In production, a small export job would write each processed `DocumentRecord` into `DOCUMENT_EXTRACTIONS`. The app store remains useful for workflow state, while Snowflake becomes the durable analytical store.

Use `schema.sql` to create the table and `analytics.sql` for example reporting queries.

