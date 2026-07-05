-- Documents by issuing state
SELECT
  issuing_state,
  COUNT(*) AS document_count,
  AVG(confidence_score) AS avg_confidence
FROM DOCUMENT_EXTRACTIONS
GROUP BY issuing_state
ORDER BY document_count DESC;

-- Average confidence by document type
SELECT
  document_type,
  COUNT(*) AS document_count,
  AVG(confidence_score) AS avg_confidence
FROM DOCUMENT_EXTRACTIONS
GROUP BY document_type
ORDER BY avg_confidence ASC;

-- License facts by issuing state
SELECT
  issuing_state,
  COUNT_IF(real_id) AS real_id_count,
  COUNT_IF(organ_donor) AS organ_donor_count,
  COUNT_IF(veteran) AS veteran_count,
  COUNT_IF(is_expired) AS expired_count,
  COUNT_IF(age_at_scan < 21) AS under_21_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY issuing_state
ORDER BY issuing_state;

-- Physical descriptor coverage
SELECT
  issuing_state,
  COUNT_IF(sex IS NOT NULL) AS sex_count,
  COUNT_IF(height IS NOT NULL) AS height_count,
  COUNT_IF(weight IS NOT NULL) AS weight_count,
  COUNT_IF(eye_color IS NOT NULL) AS eye_color_count,
  COUNT_IF(hair_color IS NOT NULL) AS hair_color_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY issuing_state
ORDER BY issuing_state;

-- Expiration buckets
SELECT
  CASE
    WHEN expiration_date IS NULL THEN 'Missing expiration'
    WHEN expiration_date < CURRENT_DATE THEN 'Expired'
    WHEN expiration_date <= DATEADD(day, 30, CURRENT_DATE) THEN 'Expires within 30 days'
    WHEN expiration_date <= DATEADD(month, 6, CURRENT_DATE) THEN 'Expires within 6 months'
    ELSE 'Valid over 6 months'
  END AS expiration_bucket,
  COUNT(*) AS document_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY expiration_bucket
ORDER BY document_count DESC;

-- Validation warning count by category
SELECT
  warning.value:category::STRING AS warning_category,
  COUNT(*) AS warning_count
FROM DOCUMENT_EXTRACTIONS,
LATERAL FLATTEN(input => validation_warnings) warning
GROUP BY warning_category
ORDER BY warning_count DESC;

-- Documents processed by day
SELECT
  DATE_TRUNC('DAY', created_at) AS processed_day,
  COUNT(*) AS document_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY processed_day
ORDER BY processed_day DESC;

-- Low-confidence extractions
SELECT
  id,
  filename,
  document_type,
  full_name,
  license_number,
  issuing_state,
  confidence_score,
  validation_status
FROM DOCUMENT_EXTRACTIONS
WHERE confidence_score < 0.75
ORDER BY confidence_score ASC;

-- Low-confidence fields for manual adjudication
SELECT
  id,
  filename,
  field.value:field::STRING AS field_name,
  field.value:confidence::FLOAT AS field_confidence,
  field.value:source::STRING AS source
FROM DOCUMENT_EXTRACTIONS,
LATERAL FLATTEN(input => field_confidences) field
WHERE field.value:needsAdjudication::BOOLEAN
ORDER BY field_confidence ASC;

-- Barcode coverage
SELECT
  document_type,
  COUNT(*) AS document_count,
  COUNT_IF(barcode_json:format::STRING = 'AAMVA_PDF417') AS barcode_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY document_type
ORDER BY document_type;

-- Redaction and raw-retention controls
SELECT
  COUNT(*) AS document_count,
  COUNT_IF(redaction_json:redactedStorageKey IS NOT NULL) AS redacted_copy_count,
  COUNT_IF(redaction_json:retainedRawOcr::BOOLEAN) AS retained_raw_ocr_count,
  COUNT_IF(redaction_json:retainedRawExtraction::BOOLEAN) AS retained_raw_extraction_count
FROM DOCUMENT_EXTRACTIONS;

-- Queue health after DynamoDB stream or scheduled export landing
SELECT
  processing_status,
  processing_job:status::STRING AS job_status,
  COUNT(*) AS document_count
FROM DOCUMENT_EXTRACTIONS
GROUP BY processing_status, job_status
ORDER BY document_count DESC;
