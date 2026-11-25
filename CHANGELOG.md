# Changelog — DNCRCheck

All notable changes to DNCRCheck are documented in this file.

## [0.5.0] - 2026-11-25
### Added
- **Open-Source MIT Release, CI Workflow & Documentation Gallery (`LICENSE`, `.github/workflows/ci.yml`, `docs/screenshots/*`, `README.md`)**:
  - Added [`LICENSE`](LICENSE) (`MIT`), Node 22 GitHub Actions continuous integration pipeline [`.github/workflows/ci.yml`](.github/workflows/ci.yml), and embedded 6 verified `AR RTL` & `EN LTR` Chrome screenshots (`1280×800` and `390×844`) inside [`README.md`](README.md).

## [0.4.0] - 2026-11-25
### Added
- **Playwright Chrome End-to-End Verification & Visual QA (`playwright.config.ts`, `tests/e2e/dncrcheck.spec.ts`)**:
  - Full desktop (`1280×800`) and mobile (`390×844`) headless Chrome E2E verification across Arabic RTL (`Telecom Ivory`) and English LTR (`Gulf Night`), preset evaluations, full remediation into sealed `DNC-YYYY-0001` dossiers, raw wire `UTF-8 BOM` CSV downloads (`EF BB BF`), `/r/:code` public report view counter persistence, and zero horizontal overflow guarantees.
- **Zero-Dollar Self-Hosting & Cloudflare Static Deployment Bundle**:
  - Added [`wrangler.jsonc`](wrangler.jsonc) (`$0` Cloudflare Workers Static Assets SPA), multi-stage Node 22 [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), [`.dockerignore`](.dockerignore), [`deploy/`](deploy/.env.example) (`systemd` service, `Caddyfile`, online `VACUUM INTO` SQLite backup script), [`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md), and [`README.md`](README.md).

## [0.3.0] - 2026-11-25
### Added
- **Interactive Bilingual Web Studio (`AR RTL / EN LTR`, React 19 + Tailwind CSS v4 + Vite)**:
  - Dual curated visual themes: **Telecom Ivory** (`light`, crisp cobalt/emerald parchment) and **Gulf Night** (`dark`, high-contrast night mode) with persisted locale/theme state.
  - **Dual-Panel SVG Telemetry (`DncrWindowAndFineSvg`)**: 24-hour UAE GST calling window gauge (`09:00–18:00`), `<= 1/day` & `<= 2/week` unanswered frequency bars, statutory `CD 57/2024` fine exposure (`AED 0..150,000`), license/telecom risk badge, and readiness index.
  - Interactive UAE Telemarketing Rules & Penalty Simulator (`RulesAndPenaltyPanel`), 6 weighted Controls & Findings Inspector (`ControlsAndFindingsPanel`), Multi-Call Log CSV Auditor (`CallLogCsvAuditPanel`, `CWE-1236` & `UTF-8 BOM`), Dossier Vault + `A4 PDF` executive brief layout (`DossierVaultAndPrint`), and read-only `/r/:slugOrCode` public report viewer.
  - **Dual Execution Modes**: auto-detects SQLite WAL backend (`/health` -> `service === 'dncrcheck'`) with `$0 localStorage` fallback (`dncrcheck.v1.*`) for static Cloudflare Workers deployment.

## [0.2.0] - 2026-11-25
### Added
- **Bilingual UAE Telemarketing Brief Builder (`src/core/briefBuilder.ts`)**: generates structured Arabic RTL and English Markdown dossiers covering prior permit status, `09:00–18:00 GST` calling window, `1/day` & `2/week` unanswered caps, licensed corporate lines (`e&`/`du`) vs. banned personal mobile lines, escalated Cabinet Resolution `57/2024` fine exposure (`AED 5k–150k`), batch CSV call-log findings, and canonical `SHA-256` digest with explicit non-MoET/non-TDRA disclaimers.
- **Zero-Dependency Node 22 SQLite WAL Backend (`server/db.mjs`, `server/app.mjs`, `server/index.mjs`, `server/app.d.mts`)**:
  - Built-in `node:sqlite` (`WAL` mode) persistence for UAE telemarketing profiles (`profiles`), versioned readiness dossiers (`assessments` with atomic `DNC-YYYY-0001` counters and immutable `locked_at` sealing), and public report view analytics (`public_report_views`).
  - Full REST API: `/health`, `/readyz`, `/api/presets`, `/api/calling-rules`, `/api/penalties`, `/api/audit-csv`, `/api/assess`, `/api/profiles`, `/api/(assessments|dossiers)` (`duplicate`, `finalize`, `lock` -> `409`, `brief.md`, `CWE-1236` `UTF-8 BOM` `export.csv`, `summary`), and `/api/public/reports/:slugOrCode`.
  - Security headers, `BASE_PATH=/dncrcheck` prefix stripping & `window.__DNCRCHECK_BASE__` injection, `413` body guard, and per-IP `429` rate limiting (exempting `/health` & `/readyz`).
  - Integration test suite (`tests/unit/dncrServer.test.ts`).

## [0.1.0] - 2026-11-25
### Added
- Zero-dependency UAE Telemarketing & Do-Not-Call Registry (`DNCR`) readiness engine (`src/core/*`) covering **Cabinet Resolution No. 56 of 2024** and **Cabinet Resolution No. 57 of 2024** (`effective 2024-08-27`):
  - **Calling Window & Cap Engine (`callingWindowAndCapEngine.ts`)**: enforces prior regulatory approval, `09:00–18:00 GST` (`Asia/Dubai`) calling hours, `<= 1 call/day` and `<= 2 calls/week` unanswered caps, zero follow-up after consumer rejection, prohibition on personal mobile lines (`corporate_licensed_uae` on `e&`/`du`), mandatory recording, and beginning-of-call identity/purpose disclosure.
  - **Penalty Exposure Engine (`dncrPenaltyEngine.ts`)**: models escalated fine tiers (`AED 50k / 75k / 150k` for DNCR calls, `AED 75k–150k` for unapproved telemarketing, `AED 5k–50k` individual personal phone exposure, and `AED 10k+` operational/dialer breaches) plus license/telecom suspension flags.
  - **Call-Log CSV Auditor (`callLogCsvAuditor.ts`)**: audits outbound marketing call logs with `CWE-1236` formula neutralization, `UTF-8 BOM` export, canonical `SHA-256` digest, and explicit non-MoET / non-TDRA / non-telecom disclaimers.
