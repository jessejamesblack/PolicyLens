# DriversLicENSe Experiment Walkthrough

DriversLicENSe is a document intelligence experiment for synthetic driver license scans. It extracts important fields, validates them, and makes the result usable for dashboard and warehouse analytics.

The upload flow stores the document, then processing runs through an OCR adapter. In AWS, that adapter can use Textract; locally it runs with mock OCR so the workflow is repeatable.

After OCR, the structured extraction layer turns raw text into normalized fields like full name, license number, issuing state, date of birth, expiration date, class, restrictions, endorsements, organ donor flag, veteran flag, and REAL ID flag. The backend validates the result with Zod and creates warnings for missing fields, expired licenses, under-21 cardholders, or low confidence.

The important design choice is that DriversLicENSe preserves both raw extracted JSON and normalized fields. Raw JSON gives auditability; normalized fields make dashboards and warehouse queries simple.

The dashboard shows processed documents, issuing-state mix, expiration buckets, confidence scores, and validation issues. The Snowflake folder shows how this would land in a warehouse.

For production hardening, the next moves would be async processing, auth/RBAC, low-confidence adjudication, monitoring and retries, stricter privacy controls, and warehouse ingestion for operational analytics.
