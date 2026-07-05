-- Premium by line of business
SELECT
  line_of_business,
  COUNT(*) AS document_count,
  SUM(premium) AS total_premium,
  AVG(confidence_score) AS avg_confidence
FROM DOCUMENT_EXTRACTIONS
GROUP BY line_of_business
ORDER BY total_premium DESC;

-- Average confidence by document type
SELECT
  document_type,
  COUNT(*) AS document_count,
  AVG(confidence_score) AS avg_confidence
FROM DOCUMENT_EXTRACTIONS
GROUP BY document_type
ORDER BY avg_confidence ASC;

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
  insured_name,
  confidence_score,
  validation_status
FROM DOCUMENT_EXTRACTIONS
WHERE confidence_score < 0.75
ORDER BY confidence_score ASC;

