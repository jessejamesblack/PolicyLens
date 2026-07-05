CREATE TABLE DOCUMENT_EXTRACTIONS (
  id STRING,
  filename STRING,
  document_type STRING,
  insured_name STRING,
  policy_number STRING,
  line_of_business STRING,
  state STRING,
  effective_date DATE,
  expiration_date DATE,
  premium NUMBER,
  per_occurrence_limit NUMBER,
  aggregate_limit NUMBER,
  confidence_score FLOAT,
  validation_status STRING,
  validation_warnings VARIANT,
  extracted_json VARIANT,
  created_at TIMESTAMP
);

