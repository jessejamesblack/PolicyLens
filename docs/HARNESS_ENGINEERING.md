# Harness Engineering

DriversLicENSe uses harness engineering in the sense described by OpenAI's "Harness engineering: leveraging Codex in an agent-first world": the scarce resource is human attention, so the repository should make intent, constraints, feedback, and quality checks legible to coding agents.

Source: https://openai.com/index/harness-engineering/

## Operating Principles

- Humans steer; agents execute within explicit repo-local constraints.
- Repository knowledge is the system of record. Important behavior, commands, architecture, and quality gates must live in versioned files.
- `AGENTS.md` is a map, not an encyclopedia. It points agents to deeper docs instead of becoming a stale manual.
- Application behavior should be legible to agents through local commands, deterministic fixtures, structured API responses, and stable logs.
- Architecture and taste should be enforced mechanically wherever possible.
- Entropy should be removed continuously with small checks and refactors.

## DriversLicENSe Harnesses

- Extraction harness: `npm.cmd run harness` checks golden synthetic license samples, expected fields, warning categories, validation status, schema versioned output, and dashboard totals.
- Architecture harness: `npm.cmd run check:architecture` checks dependency boundaries, required docs, and forbidden project-framing language.
- Build harness: `npm.cmd run build` verifies each workspace compiles.
- Cloud harness: `npm.cmd run cdk:synth` verifies AWS infrastructure can synthesize without deployment.

## Agent-Legible Surfaces

- `packages/domain` contains shared types, schemas, parsing, AAMVA barcode helpers, validation, field confidence, and dashboard aggregation.
- `apps/api` exposes OCR, barcode metadata, normalized fields, redaction metadata, processing job state, validation status, and warnings through API responses.
- `samples` contains synthetic license source documents and expected JSON fixtures.
- `snowflake` contains the downstream warehouse shape and analytics queries.
- `docs/ARCHITECTURE.md` describes boundaries and data flow.
- `docs/QUALITY.md` lists the verification loop for future changes.

## Rules To Preserve

- Keep local mode fully functional without credentials.
- Preserve schema version, normalized fields, confidence metadata, processing state, and redaction metadata.
- Add new extraction behavior through adapters or domain helpers, not UI-only logic.
- Keep queueing, barcode parsing, and redaction behind adapter interfaces.
- Add or update a golden fixture when changing extraction behavior.
- Update docs when architecture, commands, or adapter behavior changes.
