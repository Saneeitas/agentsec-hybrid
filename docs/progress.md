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

## 2026-10-21 — M4 isolated agent security laboratory and evaluation corpus

### Scope reconciliation

The roadmap's short M4 definition (isolated agent target, synthetic tools/data, repeatable ground-truth scenarios) is consistent with the approved detailed specification. M4 implements the simulator and corpus only; it does not introduce adaptive scanning, an LLM, hybrid correlation, or comparative experiments.

### Completed implementation

- Added strict `lab-scenario/v1` models for identities, objectives, tool policies, scopes, approvals, synthetic resources, controlled actions, and independently authored ground truth.
- Added five fixed mock-tool types with no real external side effects.
- Added 16 development scenarios: secure and vulnerable variants across all eight required security objectives.
- Added a separately keyed held-out registry excluded from ordinary listing and execution. It is only a separation mechanism at M4, not a completed research corpus.
- Added deterministic policy evaluation, default denial for missing tools, approval enforcement, per-run state, and `lab-trace/v1` evidence.
- Added sensitive-value redaction, 20-step, one-second, and 128 KiB output bounds.
- Added explicit stateless reset and documented why no external cleanup occurs.
- Added service-authenticated scanner list/run/reset endpoints and operator-authenticated Fastify proxies. No arbitrary tool endpoint exists.
- Added ADR-0005 plus laboratory architecture, threat model, schema, corpus methodology, evidence, reset, isolation, and limitation documentation.

### Verification evidence

- `.venv/bin/pytest services/scanner` — 34 passed after the final runtime-bound test; covers every secure/vulnerable ground-truth case, policy enforcement, unauthorized denial, sensitive access, repeatability, serialization/redaction, reset, closed/held-out registries, malformed/unknown requests, and step/runtime bounds. One upstream Starlette/AnyIO warning remains.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 8 API tests and 3 dashboard tests; database suite skipped by default.
- Disposable PostgreSQL 16 migration and API integration suite — 11 passed, confirming M2/M3 persistence, leasing, cancellation, retry, timeout, recovery, findings, and unsupported modes.
- `npm run build` — passed for API and dashboard.
- `npm audit` — 0 known vulnerabilities.
- `docker compose config --quiet`, image builds, and all three health checks — passed.
- Containerized workflow — listed 16 scenarios, ran a secure approval scenario with `require_approval`, reset it, and reran the M3 vulnerable fixture with all eight expected deterministic findings.
- `git diff --check` — passed.

### Limitations and blockers

- The simulator models policy behavior; it is not a full autonomous-agent framework and never executes untrusted code.
- Docker is defense in depth, not complete isolation. Safety primarily comes from the absence of dangerous capabilities and closed registries.
- The held-out registry is deliberately minimal and not sufficient for final statistical evaluation.
- Laboratory traces are returned as JSON but not persisted in PostgreSQL during M4.
- The configured Supabase endpoint remains unreachable, so existing migrations remain verified on disposable PostgreSQL 16 only.

### Next action

Review M4. Do not begin M5 without explicit approval.

## 2026-10-21 — M5 adaptive security assessment engine

### Scope reconciliation

The roadmap defines M5 as bounded model-assisted testing with observable evidence. The approved specification expands this into explicit adaptive components, two execution modes, evidence classifications, persistence, and reporting. It does not alter M4 ground truth or begin M6 correlation/M7 evaluation.

### Completed implementation

- Added versioned probe/result contracts and separate provider, validation, planning/execution, evidence evaluation, and normalization code.
- Added all eight controlled probe classes with recorded selection rationale and strict scenario-variant validation.
- Added deterministic offline mock provider with reproducible scripted success/error/timeout/malformed sequences, plus an optional environment-configured OpenAI-compatible adapter with structured JSON, timeouts, model/prompt versions, token metadata, and no hardcoded credentials.
- Added simulator and model-mediated execution labels. Every probe still executes through the M4 scenario registry and independent policy/tool gateway.
- Added evidence classifications and confirmed findings only for observed successful prohibited synthetic behavior; provider claims are ignored.
- Added four-probe, 1,024-token, five-second defaults plus existing scanner/job bounds.
- Added migration `0003_adaptive_assessment`, adaptive job mode metadata, result/probe/finding persistence, worker dispatch, cancellation-safe completion, and explicit hybrid rejection.
- Extended the dashboard with adaptive mode selection, probe counts, classification, evidence mode, provider/model metadata, findings, and no-finding/inconclusive states.
- Added ADR-0006 and adaptive architecture, provider, budget, evidence, and limitation documentation.

### Verification evidence

- `.venv/bin/pytest services/scanner` — 46 passed after scripted mock-sequence coverage; adaptive tests include reproducible generation, predefined error/timeout/malformed responses, all probe classes, validation, selection, probe/token budgets, real-adapter timeout handling, false success claims, inconclusive evidence, redaction, authorization boundaries, and endpoint contracts. M1–M4 scanner regressions passed.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 8 API tests and 4 dashboard tests; database suite skipped by default.
- Disposable PostgreSQL 16 migration plus API integration suite — 14 passed, including adaptive persistence, retry, cancellation, and M2/M3 lifecycle regressions.
- `npm run build` — passed for API and dashboard.
- `npm audit` — 0 known vulnerabilities.
- Docker Compose configuration, image builds, and all service health checks — passed.
- Containerized vertical slice — vulnerable simulator scan completed with one confirmed finding; secure mock-mediated scan completed with no violation observed; hybrid failed as unsupported; deterministic regression returned eight findings.

### Limitations and blockers

- No real provider credential was supplied. The optional real adapter and real model-mediated behavior are not verified; mock-mediated execution validates contracts/gateway plumbing only.
- The adapter targets an operator-configured OpenAI-compatible chat-completions interface; provider-specific compatibility must be verified before research use.
- Adaptive coverage is restricted to reviewed M4 scenarios and four probes by default. It is not a production or external-target scanner.
- M5 does not correlate deterministic/adaptive findings or calculate comparative research metrics.
- Migration `0003_adaptive_assessment` is verified on disposable PostgreSQL 16, not the unreachable configured Supabase endpoint.

### Next action

Review M5. Do not begin M6 without explicit approval.

## 2026-10-21 — M6 hybrid findings correlation

### Scope reconciliation

The roadmap defines M6 as normalization, validation, deduplication, severity handling, and traceable cross-scanner results. The approved specification adds explicit outcome classes, component/partial status, provenance persistence, and a unified dashboard report. These are compatible refinements of the same milestone. M6 does not use held-out labels, calculate comparative metrics, or begin M7.

### Completed implementation

- Enabled hybrid jobs through the existing authenticated PostgreSQL-leased lifecycle, with exact reviewed mappings for `lab://secure-agent` and `lab://vulnerable-agent` only.
- Added a separate `correlation/1.0.0` engine and `det-adaptive-map/v1` mapping from DET-001–DET-008 to controlled adaptive probe objectives.
- Added deterministic correlation outcomes for corroborated, configuration-only, behavior-only, contradictory/mitigating, inconclusive, and uncorrelated evidence.
- Added stable SHA-256 correlation identifiers/fingerprints, deterministic ordering, and duplicate suppression without text similarity or severity-only matching.
- Preserved original deterministic/adaptive results and source finding, probe, trace/outcome, method, rationale, remediation, limitation, engine, and mapping provenance.
- Kept vulnerability severity separate from evidence strength; correlation agreement does not automatically escalate severity and no numeric confidence is invented.
- Added partial-result semantics: required component/provider/correlation failures retain safe evidence in a partial report while the application job ends failed. Cancellation still wins before persistence.
- Added `hybrid-report/v1`, Drizzle tables and migration `0004_hybrid_correlation`, atomic Fastify-owned persistence, API reconstruction, and dashboard reporting for component status, outcome counts, provenance, rationale, remediation, and limitations.
- Added ADR-0007 and correlation mapping/outcome documentation. No held-out registry is accessed by hybrid execution.

### Verification evidence

- `.venv/bin/pytest services/scanner` — 53 passed; focused M6 coverage includes mapping validation, all correlation outcomes, deterministic fingerprints/order/deduplication, complete hybrid execution/redaction, partial provider failure, authentication, and unknown-target rejection. One upstream Starlette/AnyIO warning remains.
- `.venv/bin/ruff check services/scanner` — passed.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 8 API unit tests and 5 dashboard tests; the PostgreSQL suite is opt-in.
- Disposable PostgreSQL 16 migration plus `npm run test:integration --workspace=@asf/api` — 17 passed, including hybrid persistence/provenance, partial-report persistence, cancellation before persistence, transport retry exhaustion, and M1–M5 lifecycle regressions.
- `npm run build` — passed for API and production dashboard.
- `npm audit` — 0 known vulnerabilities.
- Docker Compose configuration/build and all web/API/scanner health checks — passed.
- Containerized vertical slice — registered `lab://vulnerable-agent`, created a hybrid simulator job, completed both components and correlation in one attempt, persisted eight unified findings, and returned one corroborated plus seven configuration-only results with source references intact.

### Limitations and blockers

- The deterministic-to-adaptive map is an explicit versioned engineering rule set, not empirical proof that hybrid scanning improves detection. Comparative validity remains M7 work.
- Adaptive evidence uses the deterministic mock provider by default. No actual model-mediated provider execution was performed, so no real-model vulnerability is claimed.
- Only two exact development fixture/scenario mappings are supported. Unknown or ambiguous hybrid targets fail closed.
- A no-violation observation is limited mitigating evidence for the tested action and is not proof of security.
- Migration `0004_hybrid_correlation` is verified on disposable PostgreSQL 16, not against the configured Supabase project; the previously configured hosted endpoint remains unverified from this machine.

### Next action

Review M6. Do not begin M7 comparative experiments without explicit approval.

## 2026-10-21 — M7 experimental evaluation and comparative analysis

### Scope reconciliation

The roadmap's C1/C2/C3 experiment gate matches the approved M7 specification. The actual M4 held-out registry contained only one secure placeholder, so it was insufficient for comparison. M7 therefore adds a separate five-case/eight-objective evaluation corpus using closed combinations of reviewed manifests and laboratory variants. It does not alter detection rules or use labels inside scanner execution. M8 documentation/deployment work was not started.

### Prospective protocol, pilot, and freeze

- Authored `ASF-M7-PROTOCOL-001` before execution with non-directional hypotheses, case/objective unit of analysis, explicit eligibility, rule/probe matching, undefined-denominator handling, three repetitions, rotating condition order, failures, descriptive analysis, and validity threats.
- Added independently reasoned labels for secure controls, shared weaknesses, configuration weaknesses with effective runtime controls, behavior-only weakness, incomplete evidence, and multiple weaknesses.
- The `m7-pilot-001` pilot executed 15 runs with no failures or mapping/schema errors. No label, rule, correlation mapping, hypothesis, scoring rule, or eligibility decision changed after pilot results.
- Froze corpus version 1.0.0. Harness 1.0.1 added export-only metadata fields before final execution; the amendment is recorded in the protocol.
- Final manifest records corpus SHA-256 `fd914d995c090140d88dcf4e8b5119f55402eda216953526c8309901096f177d` and protocol SHA-256 `a1344722eb8e08ba56e5ac8b58145527982d2f5a6fce6449c9867ca7bc01bdf8`.

### Completed implementation

- Added strict corpus models and validation, closed scanner-input projection, stable UUIDv5 run IDs, rotating condition order, bounded existing-engine adapters, and continued execution after retained failures.
- Added independent post-execution scoring with explicit rule/probe mappings, C3 source-provenance checks, duplicate suppression, eligibility and inconclusive classifications, and TP/FP/TN/FN metrics.
- Added precision, recall, false-positive rate, F1, evidence coverage, completion, duration, token/cost, and detected-set reproducibility calculations with JSON `null` for undefined ratios.
- Added stable JSON/CSV export plus corpus/run manifests, hashes, raw results, scored results, metrics, failure/exclusion log, summary, and validity report.
- Added ADR-0008 and research methodology/run instructions. Evaluation remains file-based and does not introduce scanner database access.

### Final controlled-simulation results

Study `m7-final-001` executed 45 runs: five cases × three conditions × three repetitions. All runs completed. There were no execution failures, timeouts, cancellations, or unsupported outcomes. The exclusion log retains 81 ineligible and 72 inconclusive repeated units.

Case-level eligibility-adjusted results were:

| Condition | Eligible | TP | FP | TN | FN | Precision | Recall | FPR | F1 | Evidence coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| C1 deterministic | 31 | 16 | 0 | 15 | 0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 |
| C2 adaptive mock | 6 | 2 | 0 | 4 | 0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 |
| C3 hybrid | 32 | 17 | 0 | 15 | 0 | 1.0 | 1.0 | 0.0 | 1.0 | 1.0 |

Completion and detected-set reproducibility were 1.0 for all conditions. Mean local durations were 0.406 ms (C1), 0.465 ms (C2), and 0.852 ms (C3). C2 and C3 each recorded 1,512 mock provider tokens; estimated provider cost was USD 0. No significance test or confidence interval was calculated because the small purposive corpus and deterministic repetitions do not provide independent statistical observations.

These perfect fixture results do not establish general effectiveness. C2's denominator is much smaller, timing is local interpreter overhead, and the exact corpus is closely aligned with explicit rules and scenarios. The results support harness correctness and controlled coverage only; they do not prove C3 superiority, real-model susceptibility, production performance, or CTRL F2 system security.

### Verification evidence

- `.venv/bin/pytest services/scanner` — 61 passed, including 8 M7 tests for schema validation, label isolation, matching/deduplication, undefined metrics, failures, freeze enforcement, repetition tracking, hashing, stable exports, and reproducibility. One upstream Starlette/AnyIO warning remains.
- `.venv/bin/ruff check services/scanner research/evaluation` — passed.
- `npm run typecheck` — passed for API, web, and contracts.
- `npm test` — passed: 8 API unit tests and 5 dashboard tests; database tests are opt-in.
- Disposable PostgreSQL 16 migrations plus API integration suite — 17 passed, covering M2–M6 persistence and lifecycle regressions.
- `npm run build` — passed for API and production dashboard.
- `npm audit` — 0 known vulnerabilities.
- Docker Compose configuration and image builds passed; web/API/scanner reached healthy state.
- Containerized M6 regression completed a hybrid scan in one attempt with both components and correlation completed, one corroborated and seven configuration-only findings.
- `git diff --check` — passed.

### Limitations and blockers

- This is a controlled deterministic-mock simulation, not a real-model evaluation. Repetitions check technical repeatability and are not independent stochastic observations.
- The five-case purposive corpus is too small and tightly aligned with implemented rules for population inference or causal claims.
- C1, C2, and C3 have different eligible denominators; headline rates must not be compared without coverage counts.
- Final raw artifacts contain synthetic traces only. No production, customer, or CTRL F2 target was assessed.
- Supabase connectivity/migrations remain unverified; M7 used files and disposable local PostgreSQL only for application regressions.

### Next action

Review M7 protocol, corpus, scoring, artifacts, and limitations. Do not begin M8 without explicit approval.

