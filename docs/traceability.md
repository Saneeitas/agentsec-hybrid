# Requirements traceability matrix

Status meanings:

- **Verified:** implementation exists and the cited verification completed successfully.
- **Partial:** useful implementation exists, but the full requirement is not satisfied.
- **Unverified:** implementation or configuration exists but has not been validated in the stated environment.
- **Out of scope:** deliberately excluded from the completed capstone.

Documentation alone is not verification. Test counts and dates are recorded in `docs/progress.md`.

## Milestone traceability

| Requirement group | Status | Implementation | Verification evidence |
|---|---|---|---|
| M1 monorepo and service health | Verified locally | `apps/web`, `apps/api`, `services/scanner`, `packages/contracts`, `compose.yaml` | API/web tests; scanner tests; Compose health checks |
| M1 managed PostgreSQL configuration | Partial | API-only `DATABASE_URL`; Drizzle migrations; TLS defaults | PostgreSQL 16 migration tests passed; hosted Supabase remains unverified |
| M2 target registry and job lifecycle | Verified locally | API routes, `Store`, PostgreSQL targets/jobs/transitions | API integration tests cover CRUD, leasing, retry, cancellation, recovery |
| M2 multi-instance-safe dispatch | Verified locally | `FOR UPDATE SKIP LOCKED`, leases and bounded worker pool | Concurrent-claim and expired-lease tests |
| M3 deterministic engine | Verified locally | closed fixture registry; DET-001–DET-008 | Rule/fixture/redaction/traversal tests and container scan |
| M4 isolated laboratory | Verified locally | closed scenario registry, deterministic simulator, synthetic tools | Secure/vulnerable scenario, bounds, reset, redaction and auth tests |
| M5 adaptive engine | Verified with mock only | provider interface, planner sequence, validation, lab execution, evidence evaluation | Mock error/timeout/malformed, budgets, evidence and lifecycle tests |
| M5 real provider behavior | Unverified | optional OpenAI-compatible adapter | No authorized credentials or real-model execution |
| M6 hybrid correlation | Verified locally | explicit rule/probe mappings, provenance, partial reports | Correlation outcome, fingerprint, persistence, retry/cancel and container tests |
| M7 controlled evaluation | Verified for frozen synthetic study | evaluation corpus, harness, scorer and preserved artifacts | 45 final runs; corpus/scoring/export tests; matching artifact hashes |
| Production or CTRL F2 assessment | Out of scope | No external target support | No production or organizational target was scanned |

## MVP functional traceability

| ID | Requirement | Status | Implementation/evidence | Remaining gap |
|---|---|---|---|---|
| FR-01 | Authorized target registration | Partial | Authenticated CRUD; strict `lab://` format; authorization confirmation; unique fixture reference | Boolean confirmation does not identify approver, owner, evidence, or expiry |
| FR-02 | Start C1/C2/C3 jobs | Verified | `POST /api/v1/scans`; dashboard mode selector; worker dispatch tests | Only reviewed fixtures are executable |
| FR-03 | Job lifecycle | Verified | queued/running/completed/failed/cancelled, transition log, leases | No operator-facing transition-history endpoint |
| FR-04 | Configuration and permission rules | Verified for supported schema | `agent-deployment/v1`, DET-001–DET-008 | Not general static analysis or arbitrary framework coverage |
| FR-05 | Bounded adaptive tests | Verified with mock | Four-probe/1,024-token/5-second defaults, M4 gateway | Real-model behavior unverified |
| FR-06 | Observable sanitized evidence | Verified locally | traces, deterministic evidence, adaptive outcomes, hybrid provenance | Retention/deletion controls are not implemented |
| FR-07 | Normalize/deduplicate cross-method findings | Verified | stable fingerprints and explicit correlation | Mapping coverage is limited and hand-authored |
| FR-08 | Severity, confidence, asset, remediation | Partial | all findings have severity/resource/remediation; adaptive confidence and hybrid evidence strength | Deterministic findings intentionally lack a confidence field; no calibrated confidence model |
| FR-09 | Persistence and reproducibility metadata | Partial | jobs/results/findings/versions/provider metadata persisted; M7 files preserve environment and hashes | Application DB does not store initiator identity, container digest, full environment, or retention metadata |
| FR-10 | History, findings, comparison summaries | Partial | dashboard displays job history and all three result types | M7 comparative summaries are files, not a dashboard view |
| FR-11 | JSON/CSV exports | Partial | APIs return JSON; M7 harness exports JSON and CSV | No per-scan download/export endpoint or dashboard export action |
| FR-12 | Versioned corpus and experiments | Verified | frozen corpus/protocol, pilot/final artifacts and hashes | Small purposive corpus limits inference |
| FR-13 | Approval for active non-lab tests | Out of scope | External tests are rejected entirely | Requires a future governance design before external testing |
| FR-14 | CI/CD gate and PDF report | Out of scope | Not implemented | Optional future work |

## Non-functional and operational traceability

| Area | Status | Confirmed evidence | Residual issue |
|---|---|---|---|
| Input safety and SSRF prevention | Verified for current scope | exact registries, schemas, `lab://` only, no target URL dereference | Optional provider base URL is operator-controlled and needs deployment egress policy |
| Secrets | Partial | ignored environment files, server-only variables, redacted evidence, token length checks | No secret manager integration or automated rotation |
| Authentication | Partial | separate constant-time operator/service bearer tokens | Single shared operator token; no users, RBAC, revocation list, or audit identity |
| Request limits | Partial | 1 MiB body, request/HTTP timeouts, schema bounds | No rate limiting or abuse lockout |
| Database security | Partial | API-only access, TLS verification defaults, migrations | Supabase connection/RLS/backups/restore unverified; RLS is not relied on because API owns access |
| Reliability | Verified locally | leases, retries, timeouts, cancellation, recovery tests | No multi-host load/chaos test or production SLO |
| Isolation | Partial | capability drop, non-root images, read-only filesystems, absent dangerous mock tools | Docker bridge is not a complete sandbox and outbound network is not denied at kernel level |
| Logging and monitoring | Partial | job transitions and result metadata provide application audit records | Fastify logger is disabled; no metrics, alerting, centralized logs, or DB readiness health check |
| Backup and recovery | Unverified | PostgreSQL data model is migration-controlled | No hosted backup policy or restore drill was executed |
| Dependency security | Verified at handover | `npm audit` reported zero known vulnerabilities | Python dependency vulnerability scanner/SBOM/signature verification is not configured |
| Privacy/retention | Partial | synthetic data only and evidence redaction | No automated retention, deletion, legal hold, or encryption-key lifecycle policy |

## Deployment blockers

1. Verify a reachable Supabase connection/pooler endpoint with certificate-validating TLS and apply migrations `0000`–`0004` in a non-production project.
2. Replace or wrap shared bearer-token authentication before any multi-user or internet exposure.
3. Define logging, monitoring, rate limiting, evidence retention, backup, restore, incident response, and credential rotation procedures.
4. Perform an authorized deployment-specific security review. No penetration test or external audit has been performed.
5. Verify the optional real provider separately before making any real-model claim; keep `ADAPTIVE_PROVIDER=mock` otherwise.
