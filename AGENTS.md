# DriversLicENSe Agent Notes

DriversLicENSe is a harness-engineering experiment for synthetic driver license OCR, extraction validation, and dashboard analytics.

Use these defaults unless the user says otherwise:

- Keep the local workflow repeatable with mock/local adapters.
- Use `npm.cmd` on Windows because the PowerShell `npm` shim may be blocked by execution policy.
- Treat `docs/` as the repository knowledge base and `AGENTS.md` as the map.
- Read `docs/HARNESS_ENGINEERING.md`, `docs/ARCHITECTURE.md`, and `docs/QUALITY.md` before broad changes.
- Shared business rules belong in `packages/domain`.
- API orchestration and infrastructure adapters belong in `apps/api`.
- UI work belongs in `apps/web`.
- CDK infrastructure belongs in `infra/cdk`.
- Preserve both raw extraction JSON and normalized fields.
- Never add real identity data; use synthetic samples only.
- Run `npm.cmd run check:architecture` after changing package boundaries or docs.
- Before claiming cloud readiness, run `npm.cmd run cdk:synth`.

Common commands:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd test
npm.cmd run check:architecture
npm.cmd run harness
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run cdk:synth
```
