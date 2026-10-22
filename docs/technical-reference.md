# Implemented system technical reference

## Responsibilities

- **React web:** loopback-oriented operator dashboard. It stores the entered operator token only in React memory, manages targets/jobs, polls status, requests cancellation, and renders deterministic, adaptive and hybrid results.
- **Fastify API:** authentication boundary, validation, target/job APIs, PostgreSQL owner, migration owner, worker host, scanner client, result persistence and laboratory proxy.
- **FastAPI scanner:** stateless execution service containing the closed fixture registry, deterministic rules, M4 laboratory, adaptive engine and hybrid correlation. It has no database dependency.
- **PostgreSQL:** targets, jobs, transitions and application reporting records. Supabase is intended only as the managed PostgreSQL provider.
- **Research harness:** file-based M7 execution/scoring package. It does not run inside the application or write application tables.

## Public API

All application routes except health/status require `Authorization: Bearer <API_AUTH_TOKEN>`.

| Method and path | Purpose |
|---|---|
| `GET /health` | API process liveness; does not prove database/scanner readiness |
| `GET /api/v1/status` | API and scanner liveness |
| `POST /api/v1/targets` | Register one authorized `lab://` fixture |
| `GET /api/v1/targets` | List up to 100 targets |
| `GET /api/v1/targets/:id` | Retrieve a target |
| `PATCH /api/v1/targets/:id` | Update name/description |
| `POST /api/v1/scans` | Queue deterministic, adaptive or hybrid job |
| `GET /api/v1/scans` | List up to 100 jobs with reconstructed result |
| `GET /api/v1/scans/:id` | Retrieve job/result |
| `POST /api/v1/scans/:id/cancel` | Cancel queued work or request in-flight cancellation |
| `GET /api/v1/lab/scenarios` | List development scenarios |
| `POST /api/v1/lab/runs` | Run one predefined scenario |
| `POST /api/v1/lab/reset` | Confirm stateless reset for a predefined scenario |

Request bodies are strict and bounded. Target references match `^lab://[a-z0-9][a-z0-9-]{1,62}$`; this format alone does not make a fixture executable—the scanner registry remains authoritative.

## Internal scanner API

Internal routes require the distinct `SCANNER_SERVICE_TOKEN`. Compose does not publish the scanner port.

| Method and path | Contract |
|---|---|
| `GET /health` | process liveness; unauthenticated inside the private network |
| `POST /internal/v1/deterministic-scans` | exact fixture → deterministic result `v1` |
| `POST /internal/v1/adaptive-scans` | exact target/mode → `adaptive-result/v1` |
| `POST /internal/v1/hybrid-scans` | exact supported target → `hybrid-report/v1` |
| `GET /internal/v1/lab/scenarios` | development scenario summaries |
| `POST /internal/v1/lab/runs` | exact scenario/run UUID → `lab-trace/v1` |
| `POST /internal/v1/lab/reset` | exact scenario → `lab-reset/v1` |
| `POST /internal/v1/mock-scans` | retained controlled M2 test endpoint |

No endpoint accepts an arbitrary filesystem path, network target, tool request, policy, expression, or source program.

## Job execution

Jobs are persisted before execution. A worker atomically claims an eligible row using PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`, assigns a lease owner/expiry and increments attempts. Per-process concurrency, scanner timeout, retry count/backoff and lease recovery are configuration bounded. Result persistence is transactional and checks cancellation/lease ownership before completion. A partial hybrid report is persisted but the job ends `failed` with `hybrid_partial_failure`.

## Database migrations

Migrations are forward-only SQL applied in journal order:

1. `0000_initial_system_metadata.sql` — migration proof table.
2. `0001_scan_orchestration.sql` — enums, targets, jobs, transitions and mock results.
3. `0002_deterministic_findings.sql` — deterministic result metadata and findings.
4. `0003_adaptive_assessment.sql` — adaptive mode, results and findings.
5. `0004_hybrid_correlation.sql` — component reports, correlation provenance and unified findings.

The API owns every table. The scanner receives neither `DATABASE_URL` nor database credentials. There is no downgrade/rollback migration; restore uses a tested database backup plus the matching repository revision.

## Deterministic rules

| Rule | Failure predicate | Severity | Primary remediation |
|---|---|---|---|
| DET-001 | Tool operations explicitly contain `*` | High | Enumerate minimum operations |
| DET-002 | Tool authorization explicitly equals `none` | High | Require invocation authorization |
| DET-003 | Declared high-risk operation has approval `none` | High | Require approval for write/delete/execute/shell/admin |
| DET-004 | Resource scopes contain `*` or `**` | High | Restrict to named laboratory resources |
| DET-005 | Credential reference is inline and contains a value | Critical | Remove value and inject from a secret store/environment |
| DET-006 | Credentials exist and logging redaction is false | High | Enable credential/sensitive-payload redaction |
| DET-007 | Public exposure explicitly has no service authentication | Critical | Keep private or require authentication |
| DET-008 | Sandboxing is explicitly false | High | Enable constrained isolation and least privilege |

Rules return `passed`, `failed`, `not_applicable`, or `unknown`. Only explicit failure creates a finding; missing evidence does not become a vulnerability.

## Laboratory and adaptive behavior

The laboratory implements five synthetic tools with per-run memory only. Scenario actions, policies and resources are immutable registry data. Runs are limited to 20 steps, one second and 128 KiB, and sensitive values are rendered `[REDACTED]`.

Adaptive execution separates provider generation, strict probe validation, lab execution, invariant evaluation and finding normalization. The default deterministic mock provider is offline. Maximum defaults are four probes, 1,024 provider tokens and five seconds. A confirmed violation requires a trace showing a prohibited synthetic action/disclosure actually succeeded. Provider prose and claimed success are ignored.

`model_mediated` is an evidence-mode label supported by the safe gateway; only mock-mediated plumbing is verified. The optional real adapter is disabled unless explicitly selected and remains unverified.

## Hybrid correlation

Correlation uses `det-adaptive-map/v1`, not unrestricted text similarity. It preserves original references and emits corroborated, configuration-only, behavior-only, mitigating, inconclusive or uncorrelated outcomes. Stable SHA-256 fingerprints deduplicate/order results. Severity describes the source weakness; evidence strength is separate and agreement does not automatically increase severity.

## Error and troubleshooting reference

| Symptom/error | Meaning and action |
|---|---|
| Startup rejects configuration | Validate all required variables and token lengths; do not print secret values |
| PostgreSQL DNS/connection failure | Use the correct Supabase direct/pooler endpoint; verify allowlists/DNS; keep TLS enabled |
| `unauthorized` | Supply the correct operator token; scanner token is different |
| `authorized_target_not_found` | Target UUID is absent or authorization confirmation is false |
| `unknown_fixture` / `unsupported_hybrid_target` | Register only an exact supported fixture for that mode |
| `scanner_timeout` | Check scanner health and budgets; bounded retries may occur |
| `hybrid_partial_failure` | Inspect component status/errors; do not treat the report as complete |
| Job remains running after worker loss | Wait past lease expiry; a healthy worker should reclaim it |
| `/health` succeeds but scans fail | Liveness does not validate database readiness or scanner execution |

## Known interface limitations

There is no OpenAPI publication, per-scan CSV download, target deletion, transition-history route, multi-user identity, dashboard laboratory page, M7 dashboard, database readiness endpoint, or administrative retention API.
