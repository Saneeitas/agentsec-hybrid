# Progress log

## 2026-10-20 — M1 bootstrap

### Scope

Milestone M1 only: repository bootstrap, service health communication, managed PostgreSQL configuration, initial migration, secure Compose defaults, and basic tests. Vulnerability scanning and LLM integration remain out of scope.

### Completed implementation

- Reconciled README database guidance with the managed-PostgreSQL-only decision.
- Created npm workspaces for the React web app, Fastify API, and versioned TypeScript contracts.
- Created the FastAPI scanner with a typed health endpoint.
- Added web → API → scanner REST/JSON status communication.
- Added server-only configuration validation for `DATABASE_URL` and certificate-validating TLS by default.
- Added a Drizzle schema and initial version-controlled migration for `system_metadata`.
- Added default Compose services for web/API/scanner only, with health checks and container hardening.
- Added placeholder-only environment documentation and ignored all real environment files.

### Verification evidence

- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 5 API tests and 1 React test.
- `.venv/bin/pytest services/scanner` — passed: 1 scanner test; one upstream Starlette/AnyIO deprecation warning reported.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run build` — passed for API and production web bundle.
- `npm audit` — passed with 0 known vulnerabilities.
- `docker compose config --quiet` with a placeholder `DATABASE_URL` — passed.
- `docker compose build` — passed for web, API, and scanner images.
- `docker compose up -d --wait` — all three services reached healthy state.
- Live probes passed: web `/` returned HTTP 200, API `/health` returned HTTP 200, and API `/api/v1/status` returned both API and scanner as `ok`.
- `npm run db:migrate` against a disposable PostgreSQL 16 container — passed; `public.system_metadata` was created and queried. The temporary container was removed.

### Blockers and limitations

- The migration was not applied to Supabase because no real `DATABASE_URL` was provided. No credential was requested, generated, or stored.
- M1 health checks verify service availability; a live database readiness check will be added when persistence enters the vertical slice in M2.

### Next action

Review M1. Do not begin M2 until explicitly approved.

## 2026-10-21 — M2 scan job management and orchestration

### Scope reconciliation

The original M2 milestone described a minimal persisted fixture-result vertical slice. The approved scope broadens the same milestone to include constrained target CRUD, complete job lifecycle APIs, PostgreSQL leasing, retry/cancellation/recovery behavior, authenticated service boundaries, and dashboard workflows. Documentation was reconciled before implementation. Real vulnerability scanning and LLM behavior remain out of scope.

### Completed implementation

- Added constrained authenticated target create/list/get/update APIs for confirmed `lab://` fixtures.
- Added persistent scan create/list/get/cancel APIs for deterministic, adaptive, and hybrid mock modes.
- Added PostgreSQL tables for targets, jobs, transitions, and mock results with a version-controlled migration.
- Added atomic `FOR UPDATE SKIP LOCKED` job leasing, per-process concurrency bounds, lease expiry recovery, finite retries/backoff, execution timeouts, and cancellation checks.
- Added a separately authenticated FastAPI mock endpoint with controlled success, failure, and timeout behavior; it has no database access.
- Added an in-memory operator-token dashboard with registration, job creation, polling, cancellation, result, loading, error, and empty states.
- Added ADRs for PostgreSQL leasing and local bearer-token boundaries.

### Verification evidence

- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 5 API unit tests and 2 dashboard tests; database-only suite skipped by default.
- `TEST_DATABASE_URL=... npm run test:integration --workspace=@asf/api` — passed: 10 PostgreSQL tests covering authorization/allowlisting, target CRUD, pre-execution persistence, exclusive concurrent claims, result persistence, queued/in-flight cancellation, retries, timeouts, and expired-lease recovery.
- `.venv/bin/pytest services/scanner` — passed: 4 tests; one upstream Starlette/AnyIO deprecation warning.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run build` — passed for API and production dashboard.
- `npm audit` — passed with 0 known vulnerabilities.
- `docker compose config --quiet` — passed with temporary required secrets.
- Docker images built and all web/API/scanner services became healthy.
- Live Docker vertical slice passed: authenticated target persisted, hybrid job persisted as queued, worker dispatched to scanner, structured result persisted, and API returned completed after one attempt.
- Disposable PostgreSQL containers and the Compose stack were removed after testing.

### Blockers and limitations

- The configured Supabase direct hostname returned DNS `ENOTFOUND` from this machine. Migration `0001_scan_orchestration` is verified on PostgreSQL 16 but not yet applied to Supabase. Use a reachable Supabase connection/pooler endpoint and retain TLS validation.
- `.env` still needs distinct high-entropy `API_AUTH_TOKEN` and `SCANNER_SERVICE_TOKEN` values before ordinary startup. Verification used temporary process-level tokens.
- Operator bearer tokens are appropriate only for this loopback-bound single-researcher prototype; multi-user authentication remains an explicit later decision.
- Mock scan modes do not perform vulnerability assessment, make target requests, invoke an LLM, or generate research evidence.

### Next action

Review M2 and resolve the hosted database endpoint. Do not begin M3 without explicit approval.

## 2026-10-21 — M3 deterministic vulnerability scanning

### Scope reconciliation

The repository roadmap described M3 only as agent-specific rules, unit tests, and classification of known secure/vulnerable fixtures. The approved M3 specification is a compatible expansion: it defines the versioned manifest, eight rules, trusted fixture registry, lifecycle integration, normalized persistence, reporting, and verification required to make that milestone operational. M2 architecture and job semantics remain authoritative; adaptive and hybrid execution remain unsupported in M3.

### Current status

Implemented and verified locally; awaiting review.

### Completed implementation

- Added strict `agent-deployment/v1` models, a 64 KiB manifest bound, and a closed packaged `lab://` fixture registry.
- Added secure, intentionally vulnerable, incomplete, malformed, and unsupported-version synthetic development fixtures with documented expectations.
- Implemented DET-001 through DET-008 as ordered explicit predicates with passed, failed, not-applicable, and unknown outcomes.
- Added sanitized normalized findings, deterministic SHA-256 fingerprints, rule/engine/schema/fixture versions, and a 100-finding persistence bound.
- Added the authenticated deterministic scanner endpoint without database, arbitrary path, code execution, expression evaluation, or external network access.
- Added migration `0002_deterministic_findings` and atomic API-owned persistence for result metadata, evaluations, and findings.
- Integrated real deterministic execution with M2 leasing, timeout, retry, cancellation, and recovery controls. Adaptive/hybrid jobs now fail explicitly as unsupported without invoking the scanner.
- Extended the dashboard with evaluation counts, severity groups, affected resources, sanitized evidence, remediation, and unsupported-mode errors.
- Added ADR-0004 and fixture/rule documentation.

### Verification evidence

- `.venv/bin/pytest services/scanner` — 10 passed; covers every rule's secure/vulnerable case, reproducibility, secret redaction, incomplete/malformed/unsupported manifests, traversal/unknown fixtures, authenticated execution, and unsupported modes. One upstream Starlette/AnyIO deprecation warning remains.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 5 API unit tests and 3 dashboard tests; PostgreSQL suite skipped by default.
- Disposable PostgreSQL 16 migration plus `npm run test:integration --workspace=@asf/api` — 11 passed, including finding persistence, exclusive claims, cancellation, bounded failures/timeouts, lease recovery, and terminal unsupported modes.
- `npm run build` — passed for API and production dashboard.
- `npm audit` — 0 known vulnerabilities.
- `docker compose config --quiet`, image builds, and all service health checks — passed.
- Containerized vertical slice — registered `lab://vulnerable-agent`, persisted a deterministic job before execution, completed in one attempt, persisted and returned all eight expected findings.
- `git diff --check` — passed.

### Limitations and blockers

- The configured Supabase direct hostname remains unreachable from this machine. Migration `0002_deterministic_findings` and the workflow are verified on disposable PostgreSQL 16, not against the configured Supabase project.
- The registry is intentionally closed and contains development fixtures only. It is not a held-out research evaluation corpus.
- Findings are configuration weaknesses; M3 performs no runtime exploitation or behavioral validation.
- Adaptive scanning, hybrid correlation, report export, and research experiments remain later milestones.

### Next action

Review M3. Do not begin M4 without explicit approval.

