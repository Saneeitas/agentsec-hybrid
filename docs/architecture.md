# Architecture

## Current component boundaries

```text
Browser
  │ GET /api/v1/status (REST/JSON)
  ▼
React web ───────────────► Fastify API ───────────────► Supabase PostgreSQL
                              │                         DATABASE_URL + TLS
                              │ GET /health (REST/JSON)
                              ▼
                          FastAPI scanner
```

The browser receives only the API base URL. The Fastify API is the sole owner of application persistence, Drizzle schema definitions, migrations, and job orchestration. The scanner remains stateless and communicates only with the API through authenticated internal HTTP endpoints.

## Database boundary

Supabase is used only for managed PostgreSQL. Supabase Auth, Storage, Realtime, client SDKs, and privileged browser keys are excluded. `DATABASE_URL` is validated at API startup and passed to the PostgreSQL driver with certificate validation enabled by default. `DATABASE_SSL=false` exists only for explicitly local/offline test databases.

The initial migration creates `system_metadata`, a minimal table that proves migration ownership without prematurely implementing scan-domain persistence. Future domain tables belong to later milestones and require version-controlled migrations.

## Network and container boundary

The default Compose project contains `web`, `api`, and `scanner` only. It binds web and API ports to loopback; the scanner is reachable only on the Compose network. Containers run as non-root users, drop Linux capabilities, use read-only root filesystems, and receive small temporary filesystems where required. The API applies an explicit web origin and bounded request timeouts.

## M1 request flow

1. The browser loads the static React application.
2. React requests `GET /api/v1/status` from Fastify.
3. Fastify requests `GET /health` from the scanner with a bounded timeout.
4. Fastify returns both service health objects as versioned JSON.

M1 introduced this health flow. M2 adds authenticated application workflows without adding real scanning or LLM calls.

## M2 job lifecycle

```text
dashboard → authenticated API → queued PostgreSQL job
                                  │
                      atomic lease (SKIP LOCKED)
                                  ▼
                            API worker pool
                                  │ authenticated mock request
                                  ▼
                         stateless FastAPI scanner
                                  │ structured v1 result
                                  ▼
                    PostgreSQL result + transition log
```

Jobs move through `queued → running → completed|failed|cancelled`. Transient failures and timeouts return to `queued` until their finite attempt budget is exhausted. Running jobs carry a lease owner and expiry; another worker may reclaim an expired lease after interruption. A transaction and row lock prevent simultaneous claims. Cancellation of queued work is immediate; cancellation requested during a mock call is checked before result persistence.

Application tables (`assessment_targets`, `scan_jobs`, `scan_job_transitions`, and `mock_scan_results`) are separate from future experimental evidence. Targets use non-network `lab://` fixture references. The worker never dereferences them, preventing arbitrary URL scanning and SSRF in M2.

## M2 authentication boundary

Target and scan APIs require an operator bearer token. The dashboard accepts it interactively and retains it only in memory. The scanner execution endpoint requires a distinct service token and is not published outside the Compose network. These tokens are a local-research control, not a multi-user identity system.

## M3 deterministic assessment flow

For a deterministic job, the worker sends the target's exact `lab://` identifier to the authenticated scanner. The scanner resolves it from a closed packaged registry, enforces a 64 KiB manifest limit, validates `agent-deployment/v1`, and applies ordered data-only predicates. Manifest content is never treated as code, expressions, paths, or network locations.

The API bounds and atomically persists result metadata, evaluations, findings, and the completed transition. Cancellation observed before persistence wins. Adaptive and hybrid jobs terminate with `unsupported_scan_mode` in M3 without calling the scanner. These tables are application records; later held-out research evidence requires a separate corpus and storage boundary.

## Trust assumptions

- Operators provide a correctly scoped Supabase role and rotate credentials outside the repository.
- Production and research/experimental Supabase projects or schemas remain separate.
- TLS certificate verification stays enabled for externally hosted PostgreSQL.
- Only explicitly authorized synthetic targets will be introduced in later milestones.

## M4 laboratory boundary and threat model

```text
operator → authenticated Fastify scenario API → service-authenticated scanner
                                                   │
                                      closed scenario registry
                                                   │
                                  deterministic in-memory simulator
                                                   │
                                    redacted lab-trace/v1 JSON
```

The caller selects only an exact registered scenario ID. Actions, policies, resources, tool arguments, paths, URLs, and code cannot be supplied through the interface. Each run loads an immutable fixture, evaluates at most 20 actions for at most one second, bounds serialized evidence to 128 KiB, and discards all state.

Threats addressed include arbitrary tool execution, SSRF, command execution, path traversal, cross-scope synthetic access, missing authorization/approval, evidence leakage, unbounded runs, and ground-truth contamination by scanner output. The runtime has no network, shell, cloud, email, or general filesystem tool implementation. Docker further removes capabilities and external scanner exposure, but is defense in depth and not described as complete isolation.

Development and held-out registries are separate. Ordinary APIs expose only development scenarios. Ground-truth decisions and evidence codes are manually derived from the policy/action pairs and tested independently from deterministic scanner findings.

## M5 adaptive assessment flow

```text
adaptive job → bounded planner → provider → strict probe validator
                                            │
                          reviewed scenario mapping only
                                            ▼
                              M4 policy/tool gateway
                                            ▼
                      sanitized trace → invariant evaluator
                                            ▼
                     adaptive result/findings → Fastify persistence
```

The deterministic rule engine and adaptive engine share neither decision logic nor result tables. The adaptive planner sees prior classifications, not unrestricted target state. Provider output is untrusted and must match the exact expected probe ID, class, and secure/vulnerable scenario variant. Model-mediated proposals still pass through M4 authorization, scope, and approval controls.

The API worker retains PostgreSQL leasing, timeout, retry, recovery, and cancellation-before-persistence semantics. `adaptive_scan_results` and `adaptive_findings` store application reporting records separately from the M6 hybrid report tables.

## M6 hybrid assessment and correlation flow

```text
hybrid job → exact target mapping → deterministic engine
                            │
                            └────────→ adaptive engine → M4 gateway
                                              │
                     normalized source evidence
                                              ▼
                       explicit correlation map v1
                                              ▼
          unified findings + immutable source provenance
                                              ▼
                    Fastify-owned PostgreSQL persistence
```

Only `lab://secure-agent` and `lab://vulnerable-agent` have reviewed manifest/scenario mappings. The scanner executes the components in order and never infers a scenario from text, URLs, or held-out labels. Correlation uses the versioned DET rule-to-probe map documented with the scanner. Exact objective, mapping, outcome, and affected-resource evidence determine the relationship; shared severity alone cannot correlate findings.

The result contract is `hybrid-report/v1`. Original deterministic and adaptive results remain embedded and are never overwritten. Correlation records retain source finding/probe references, source methods, observed outcomes, rationale, engine/mapping versions, remediation, and limitations. Fingerprints derive from normalized stable attributes, enabling deterministic ordering and duplicate suppression without depending on timestamps.

Severity continues to describe the underlying weakness and is not automatically escalated when both methods agree. Correlation outcome describes evidence strength separately. A prevented tested action can produce contradictory/mitigating evidence; it does not negate the configuration weakness or prove general security.

`hybrid_scan_reports`, `hybrid_correlations`, and `hybrid_unified_findings` are application-reporting tables owned by Fastify. A component error or provider timeout produces `partial_failure`, preserves safe completed evidence, and leaves the scan job failed. Cancellation wins before persistence, and retries replace neither completed records nor create duplicate findings because persistence is transactional and keyed by stable identifiers.

## M7 evaluation boundary

```text
frozen corpus mappings ──► execution adapter ──► existing C1/C2/C3 engines
       labels excluded                              │
                                                    ▼
                                              raw outputs
                                                    │
frozen labels ─────────────────────────────► independent scorer
                                                    │
                              scored rows, metrics, hashes, reports
```

The evaluation package is file-based and does not add a database dependency. Exact `lab://eval-*` mappings select reviewed manifest and scenario variants. Ground-truth labels are not imported by deterministic, adaptive, or correlation modules and are removed from execution inputs. The post-execution scorer matches stable rule IDs and probe types, and for C3 requires source references preserved by unified findings.

The unit of analysis is a case/objective vulnerability instance. Ineligible, inconclusive, partial, failed, timed-out, cancelled, and unsupported outcomes remain distinct from true negatives. Stable UUIDv5 run IDs identify repetitions, while timestamps and trace UUIDs remain raw provenance and do not affect matching. JSON/CSV exports record corpus/protocol/result hashes, engine/provider versions, budgets, duration, findings, exclusions, and failures.

This boundary prevents normal scanner logic from consulting evaluation labels, but it does not make the corpus statistically representative. The study is a controlled synthetic simulation using a deterministic mock provider; Supabase and real-model behavior are outside the verified boundary.

