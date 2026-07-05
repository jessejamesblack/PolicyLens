# DriversLicENSe Experiment Walkthrough

DriversLicENSe is a document intelligence experiment for driver license scans. It extracts important fields, validates them, and makes the result usable for dashboard and warehouse analytics.

The upload flow stores the document, then puts processing on a queue. In AWS, SQS retries failed jobs and sends exhausted messages to a dead-letter queue. Locally, the inline queue keeps the workflow easy to run.

After OCR, the app checks for AAMVA PDF417 barcode payloads, then the structured extraction layer turns raw text into normalized fields like full name, license number, issuing state, date of birth, expiration date, class, restrictions, endorsements, organ donor flag, veteran flag, and REAL ID flag. The backend validates the result with Zod and creates warnings for missing fields, expired licenses, under-21 cardholders, or low confidence.

The important design choice is that DriversLicENSe preserves normalized fields, schema version, field confidence, barcode metadata, processing state, and redaction metadata together. That keeps the app debuggable without retaining raw PII by default.

The dashboard shows processed documents, issuing-state mix, expiration buckets, confidence scores, validation issues, and filterable slices. The Snowflake folder shows how DynamoDB stream or scheduled-export data would land in a warehouse.

The detail page shows low-confidence fields and lets a human save a correction. The project still leaves production identity verification, auth/RBAC, and compliance hardening outside the app boundary.
