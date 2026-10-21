# Requirements and acceptance criteria

Status values are **not started**, **in progress**, and **verified**. A requirement is only verified after its acceptance evidence has run successfully.

## Milestone M1 — Project Bootstrap

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M1-01 | Monorepo structure | React web, Fastify API, shared contracts, and FastAPI scanner have independent build/test configuration | Verified |
| M1-02 | Service communication | The web calls the API status endpoint; the API calls the scanner health endpoint over REST/JSON | Verified |
| M1-03 | Managed database configuration | Only the API reads `DATABASE_URL`; Drizzle owns schema/migrations; TLS validation defaults on | Verified |
| M1-04 | Initial migration | A reproducible Drizzle migration creates the initial metadata table | Verified |
| M1-05 | Local orchestration | Default Compose starts web/API/scanner with health checks and no PostgreSQL container | Verified |
| M1-06 | Secure defaults | Non-root containers, dropped capabilities, read-only filesystems, bounded requests, restricted CORS, and placeholder-only environment examples | Verified |
| M1-07 | Automated checks | Type checks, unit tests, builds, Python lint/tests, Compose validation, and service smoke tests pass | Verified |
| M1-08 | Scope boundary | No vulnerability scanning, LLM integration, Supabase Auth, Storage, or Realtime is implemented | Verified |

## MVP functional requirements

M2 partially implements the infrastructure portions of FR-01, FR-02, FR-03, FR-09, and FR-10 using synthetic targets and mock results. These broader MVP requirements are not marked complete because actual assessment behavior and full reporting remain later-milestone work. FR-04 through FR-08 and FR-11 through FR-14 remain not started.

## Milestone M2 — Scan Job Management and Orchestration

The repository originally defined M2 only as a vertical slice in which the API creates a scan, the scanner returns a fixture result, the database stores it, and the UI displays it. The approved M2 scope retains that acceptance gate and adds the lifecycle, security, and resilience criteria below.

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M2-01 | Constrained target registry | Authenticated create/list/get/update supports isolated synthetic fixtures only and rejects external URLs or unconfirmed authorization | Verified |
| M2-02 | Persistent scan jobs | Authenticated create/list/get/cancel persists target, mode, lifecycle status, timestamps, attempts, and execution metadata | Verified |
| M2-03 | Durable dispatch | PostgreSQL leasing atomically prevents duplicate claims across workers and enforces lease expiry | Verified |
| M2-04 | Bounded execution | Worker concurrency, execution timeout, retry count/backoff, cancellation, and interrupted-job recovery are enforced | Verified |
| M2-05 | Scanner integration | Private authenticated mock endpoint supports controlled success, failure, and timeout with a versioned structured result | Verified |
| M2-06 | Persistence and audit | Versioned migration stores targets, jobs, transitions, and mock results separately from future experimental evidence | Verified |
| M2-07 | API security | Operator bearer authentication, scanner service authentication, body limits, validation, and strict target allowlisting are verified | Verified |
| M2-08 | Dashboard workflow | User can supply an operator token in memory, register a target, start/cancel scans, and inspect status/results with loading/error/empty states | Verified |
| M2-09 | Automated verification | Unit and PostgreSQL integration tests cover lifecycle, concurrency, cancellation, retries, timeouts, persistence, recovery, and rejected targets | Verified |
| M2-10 | Scope boundary | No real deterministic/adaptive scanning, LLM calls, correlation, or research experiments are implemented | Verified |

## Security acceptance notes

- `DATABASE_URL` is server-only and must never use the `VITE_` prefix.
- The scanner receives no database credential and has no database dependency.
- Hosted database migration verification requires an operator-provided Supabase `DATABASE_URL`; no credential is stored in this repository.
- A future local integration database must be opt-in and must not be added to the default Compose configuration.

