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

## Milestone M3 — Deterministic Vulnerability Scanning

The original roadmap summarized M3 as agent-specific rules, tests, and fixture classification. The approved M3 specification expands that same scope into the following verifiable requirements without introducing adaptive or hybrid execution.

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M3-01 | Versioned deployment manifest | Strict `agent-deployment/v1` schema distinguishes known, unknown, and absent configuration | Verified |
| M3-02 | Trusted fixture registry | Exact `lab://` identifiers resolve only from a versioned packaged registry; traversal, URLs, unknown fixtures, malformed manifests, and unsupported versions are rejected | Verified |
| M3-03 | Deterministic rules | DET-001 through DET-008 return explicit pass, fail, not-applicable, or unknown outcomes and findings only when evidence is sufficient | Verified |
| M3-04 | Safe reproducible findings | Findings include stable fingerprints, sanitized evidence, rationale, affected resources, severity, remediation, versions, scan ID, and timestamp | Verified |
| M3-05 | Lifecycle integration | Deterministic jobs use existing persistence, leases, timeouts, retries, cancellation, and recovery; adaptive/hybrid jobs fail as unsupported | Verified |
| M3-06 | Persistence | Versioned Drizzle migration stores deterministic result metadata, rule evaluations, and normalized findings separately from experimental evidence | Verified |
| M3-07 | Dashboard reporting | Dashboard displays status, severity grouping, findings, remediation, and evaluation counts with error/unsupported states | Verified |
| M3-08 | Verification | Rule, fixture, redaction, traversal, serialization, persistence, lifecycle, UI, build, audit, and Compose checks pass | Verified |
| M3-09 | Scope boundary | No adaptive LLM testing, attack generation, hybrid correlation, production scanning, remediation, or external scanner integration | Verified |

## Milestone M4 — Isolated Agent Security Laboratory and Evaluation Corpus

The roadmap's concise M4 lab milestone is expanded by the approved specification without changing M1–M3 boundaries.

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M4-01 | Deterministic simulator | Data-only agent, tools, resources, policies, approvals, and traces; no real I/O or arbitrary execution | Verified |
| M4-02 | Scenario corpus | Versioned secure/vulnerable scenarios cover all eight required security objectives with independent ground truth | Verified |
| M4-03 | Safe evidence | Versioned JSON traces are ordered, bounded, reproducible, and redact synthetic sensitive values | Verified |
| M4-04 | Closed interfaces | Authenticated list/run/reset accepts only registered scenario IDs and no arbitrary tool requests | Verified |
| M4-05 | Isolation | Closed registries, strict validation, step/time/output limits, no external network, shell, cloud, or arbitrary filesystem access | Verified |
| M4-06 | Regression | M1–M3 checks and deterministic scan behavior continue to pass | Verified |
| M4-07 | Scope boundary | No LLM probes, prompt generation, adaptive detection, hybrid correlation, or research experiments | Verified |

## Milestone M5 — Adaptive Security Assessment Engine

The roadmap's bounded model-assisted testing gate is expanded by the approved M5 specification. Hybrid correlation and comparative evaluation remain later milestones.

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M5-01 | Component boundaries | Versioned planner, generator/provider, validator, lab adapter, evidence evaluator, and normalizer remain separate from deterministic rules | Verified |
| M5-02 | Provider abstraction | Offline deterministic mock and optional environment-configured real adapter enforce structured output, timeout, token, model, and prompt metadata | Verified |
| M5-03 | Bounded adaptation | Eight controlled probe classes, rationale-bearing selection, finite probes/steps/time/tokens, and no autonomous unbounded loop | Verified |
| M5-04 | Evidence integrity | Confirmed violations require observed allowed prohibited action/disclosure; claims alone are ignored | Verified |
| M5-05 | Execution modes | Simulator and model-mediated modes are distinguished and all proposed actions pass through the independent lab gateway | Verified |
| M5-06 | Lifecycle integration | Adaptive jobs are authenticated, leased, cancellable, retryable, persisted, and displayed; hybrid remains unsupported | Verified |
| M5-07 | Security | Closed targets/scenarios, strict validation, redaction, no arbitrary I/O/code/tool execution, and explicit unsupported configurations | Verified |
| M5-08 | Verification and scope | Mock workflows and regressions pass without paid access; no M6/M7 functionality | Verified |

