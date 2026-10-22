# Final regression verification

Execution window: 2026-10-22 04:09–04:12 WAT. Workspace: local macOS environment. No hosted Supabase or real LLM credential was used.

## Toolchain

- Node.js `v22.14.0`
- npm `11.7.0`
- Python `3.13.3`
- Docker `28.4.0`
- Docker Compose `v2.39.4-desktop.1`
- Disposable PostgreSQL image: `postgres:16-alpine`

## Executed checks

| Command/workflow | Actual result |
|---|---|
| `.venv/bin/ruff check services/scanner research/evaluation` | Passed |
| `.venv/bin/pytest -q services/scanner` | 61 passed; one upstream Starlette/AnyIO deprecation warning |
| `npm run typecheck` | API, web and contracts passed |
| `npm test` | 8 API and 5 dashboard tests passed; 17 opt-in DB tests skipped in this command |
| `npm run build` | API TypeScript and production Vite build passed |
| `npm audit` | 0 known vulnerabilities |
| `git diff --check` | Passed |
| `DATABASE_URL=<local> DATABASE_SSL=false npm run db:migrate` | Migrations `0000`–`0004` applied to disposable PostgreSQL 16 |
| `TEST_DATABASE_URL=<local> npm run test:integration --workspace=@asf/api` | 17 passed |
| Temporary `m8-reproduction-check`, three repetitions | 45 runs; C1/C2/C3 case-level counts reproduced; frozen directory not used |
| `docker compose config --quiet` | Passed with temporary required variables |
| `docker compose up -d --build --wait` | Images built; web/API/scanner healthy |
| API and scanner status probes | HTTP success; both services reported `ok` |
| Container deterministic regression | Completed in one attempt with 8 findings |
| Container adaptive mock regression | Completed in one attempt with 1 confirmed evidence-backed finding |
| Container hybrid regression | Completed in one attempt; all components complete; 8 unique results (1 corroborated, 7 configuration-only) |
| High-confidence repository secret-pattern scan | No matches outside excluded local environment/dependency paths |
| Research artifact raw synthetic-secret scan | No raw synthetic secret values found |
| `git check-ignore -q .env` | `.env` ignore rule verified |

No dedicated secret-scanning product such as Gitleaks or TruffleHog was installed, so the secret check was a documented high-confidence pattern scan rather than a comprehensive credential audit. npm audit covers the JavaScript dependency tree; no Python CVE scanner was configured.

## Frozen M7 integrity

Pre-M8 and post-verification hashes matched for the frozen corpus, protocol and every file under `research/experiments/m7-final`. Key hashes:

- Corpus: `fd914d995c090140d88dcf4e8b5119f55402eda216953526c8309901096f177d`
- Protocol: `a1344722eb8e08ba56e5ac8b58145527982d2f5a6fce6449c9867ca7bc01bdf8`
- Final raw results: `15b89dfe438f2a2d722f5a19b50b218dc95b9f26bf3e270f839b6d6e449d21af`
- Final scored results JSON: `30d76dce3fbd077692730a9fbed365a8729fe956d8139a783aeaff7e94bdc7b4`
- Final metrics JSON: `4b9c9f47cee48095e323cb66885d78e8fc88115d2cf69cf158708d55e5e0e179`
- Final run manifest: `a0d5aef47e4bcd1795dc73d708270a96bf526807f67cfffb7241dcd302f9a0cc`

## Unverified items

- Hosted Supabase DNS/connectivity, TLS handshake, role permissions, migrations, backup and restore.
- Optional real-provider request compatibility and real-model behavior.
- Production deployment, external targets, load/chaos behavior and multi-host workers.
- Penetration test, independent security audit, Python CVE scan and SBOM.

The Compose stack and disposable PostgreSQL container were removed after verification. Temporary evaluation output was written under `/tmp`, never into the frozen M7 final directory.
