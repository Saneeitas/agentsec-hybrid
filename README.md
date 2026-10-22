# Hybrid Vulnerability Assessment Framework for Secure Autonomous AI Agents

> **Research title:** A Hybrid Vulnerability Assessment Framework for Secure Autonomous AI Agents using CTRL F2  
> **Status:** M8 final validation and academic handover complete; deployment blockers documented
> **Organization:** CTRL F2 (proposed case-study environment; access and scope require explicit authorization)  
> **Document role:** Living project overview and progress index. The repository's requirements, architecture, decisions, and experiments provide the detailed source of truth.
This repository contains the implemented capstone platform and its frozen controlled evaluation. Milestones M1–M7 are complete; M8 final validation and handover is approved. No production deployment, real-model evaluation, or new detection research is authorized as part of M8.
## 1. Overview

This master's cybersecurity capstone develops and evaluates a **hybrid vulnerability assessment framework** for autonomous AI agent deployments. It combines:

- **Deterministic checks:** reproducible rules for configuration, access controls, tool permissions, secret exposure, and supported deployment artifacts.
- **Non-deterministic/adaptive tests:** controlled model-assisted probes of agent behavior, such as prompt injection, unauthorized tool-use attempts, and sensitive-data exposure.
- **Hybrid assessment:** normalization, evidence validation, deduplication, risk prioritization, and reporting across both methods.

The framework is an **assessment tool**, not a guarantee of security or a production intrusion prevention system. Findings must be supported by observable evidence; an LLM's assertion alone is not proof of a vulnerability.

### Primary research question

Does a hybrid approach improve detection coverage and assessment quality for autonomous AI agent security weaknesses compared with deterministic-only and adaptive-only scanning, and at what cost in false positives, runtime, and reproducibility?

## 2. Scope and boundaries

**MVP in scope**

1. Register and manage **explicitly authorized** local/sandbox assessment targets.
2. Launch and track scans in deterministic-only, adaptive-only, and hybrid modes.
3. Inspect a documented subset of agent configurations and deployment artifacts.
4. Exercise a sandbox AI agent using controlled adversarial test scenarios.
5. Record actual tool calls, policy outcomes, and sanitized evidence.
6. Normalize, correlate, validate, and prioritize findings.
7. View findings, scan status, and export machine-readable reports.
8. Run reproducible comparative experiments against a versioned test corpus containing vulnerable **and secure** cases.

**Out of scope for MVP**

- Scanning arbitrary public targets, client infrastructure, or production systems.
- Exploitation, persistence, or data extraction outside isolated synthetic test environments.
- Full coverage of all agent frameworks, cloud providers, or vulnerability classes.
- Automatically patching target applications or enforcing production deployment gates.
- Kubernetes, Kafka, Elasticsearch, and other infrastructure without demonstrated need.

**Organizational constraint:** CTRL F2's actual systems, data, credentials, and client environments must not be scanned without written permission, defined scope, and appropriate safeguards. Until then, use only owned sandbox targets and synthetic data. Do not assert unverified weaknesses in CTRL F2's systems.

## 3. Proposed architecture

A **single Git repository (monorepo)** with independently runnable services, orchestrated locally using Docker Compose:

```text
React/TypeScript dashboard
          |
          v
Fastify/TypeScript API  <----> Supabase PostgreSQL
          |
       HTTP/JSON
          |
          v
Python/FastAPI scanner
  | deterministic rules and tool adapters
  | adaptive test runner and observations
  | correlation, validation, reporting
          |
          v
Isolated, authorized AI agent test lab
```

The API owns persistence and user-facing job management. The scanner returns structured findings via versioned contracts; it should not need direct database access in the initial design. Scans may run asynchronously, with polling for job status. Secure service-to-service communication and bounded job execution are required.

### Database Architecture — Supabase PostgreSQL

The project uses **Supabase-hosted PostgreSQL** as its primary application database.

- Supabase provides managed PostgreSQL hosting.
- Supabase is used strictly as a managed PostgreSQL provider. Supabase Auth, Storage, Realtime, and other platform services are out of scope unless explicitly approved.
- The TypeScript/Fastify backend owns database access and schema migrations.
- Drizzle ORM is the preferred TypeScript database access layer.
- The Python/FastAPI scanning service communicates with the TypeScript backend through internal HTTP APIs and does not directly access the application database.
- Database credentials must be provided through server-side environment variables, never committed to the repository, and never exposed to the frontend.
- Docker Compose runs the local application services without requiring a PostgreSQL container.
- A local PostgreSQL instance may be used for isolated integration tests or offline development.
- Database migrations must be version-controlled and reproducible.
- Research experiments should use synthetic data and avoid exposing sensitive scan evidence in externally hosted databases.

**Required environment variable:**

`DATABASE_URL` — Supabase PostgreSQL connection string.

Use a suitable Supabase connection endpoint for the application's connection lifecycle and configure certificate-validating TLS according to Supabase's documentation. Keep production and experimental data environments separate.

### Technology choices (provisional)

| Layer | Choice | Purpose |
|---|---|---|
| Web | React + TypeScript + repository CSS | Assessment dashboard |
| API | Node.js + TypeScript + Fastify | Authentication, targets, jobs, reporting API |
| Scanner | Python + FastAPI | Deterministic and adaptive assessments |
| Persistence | Supabase PostgreSQL + Drizzle ORM | Managed application database for scan jobs, targets, findings, and experiment metadata |
| Orchestration | Docker Compose | Local application services and isolation without a required PostgreSQL container |
| Lab target | Deterministic Python simulator with synthetic tools | Controlled security scenarios |
| Deterministic tools | Custom DET-001–DET-008 rule engine | Supported manifest checks |
| Adaptive model | Deterministic mock default; optional unverified OpenAI-compatible adapter | Generate/select bounded test cases |
| Testing | Vitest/Supertest, pytest, integration and end-to-end tests | Quality and research validation |

**Do not add dependencies or services solely for architectural novelty.** Pin versions and document licenses, resource needs, and costs before introducing external scanners or models.

## 4. Suggested repository layout

```text
.
├── apps/
│   ├── web/                  # React dashboard
│   └── api/                  # Fastify API
├── services/
│   └── scanner/              # FastAPI scanning service
│       ├── deterministic/
│       ├── adaptive/
│       ├── correlation/
│       └── tests/
├── labs/
│   └── agent-target/         # Isolated synthetic agent and fixtures
├── packages/
│   └── contracts/            # OpenAPI / JSON Schema source of truth
├── infrastructure/
│   └── docker/
├── research/
│   ├── protocols/            # Versioned study plans and decisions
│   ├── datasets/             # Ground-truth vulnerability corpus
│   ├── experiments/          # Run manifests and analysis
│   └── results/              # Generated results; redact secrets
├── docs/
│   ├── requirements.md       # Detailed requirements and acceptance criteria
│   ├── architecture.md       # Component boundaries and threat model
│   ├── decisions/            # Architecture decision records
│   └── progress.md           # Milestone log, blockers, next actions
├── .env.example              # Placeholder values only; no real secrets
├── compose.yaml
└── README.md
```

The laboratory is implemented inside the scanner package; research protocol, corpus and artifacts are under `research/`.

### M1 local setup

Prerequisites: Node.js 22+, Python 3.12+, Docker with Compose, and a Supabase PostgreSQL connection string.

```bash
cp .env.example .env
# Replace DATABASE_URL in .env with the server-side Supabase PostgreSQL connection string.
npm install
python3 -m venv .venv
.venv/bin/pip install -e './services/scanner[dev]'
npm run typecheck
npm test
.venv/bin/pytest services/scanner
.venv/bin/ruff check services/scanner
npm run db:migrate
docker compose up --build --wait
```

Open `http://localhost:5173`. The API is available at `http://localhost:3000`; the scanner is internal to the Compose network. Stop the stack with `docker compose down`.

`npm run db:migrate` applies the version-controlled Drizzle migration using `DATABASE_URL`. Keep `DATABASE_SSL=true` for Supabase. Set it to `false` only for an explicitly local integration-test database.

### M2 operation and security

Set distinct high-entropy `API_AUTH_TOKEN` and `SCANNER_SERVICE_TOKEN` values in `.env`. Enter the operator token into the dashboard at runtime; it is held in memory only. The scanner token is available only to the API and scanner containers.

M2 accepts only confirmed synthetic fixtures with identifiers matching `lab://...`; it never fetches a target URL. Authenticated users can register/update fixtures and create/list/get/cancel deterministic, adaptive, or hybrid mock jobs. PostgreSQL-backed workers atomically lease queued work, retry bounded failures/timeouts, recover expired leases, and persist structured mock results. No vulnerability assessment is performed.

### M3 deterministic scanning

Successful deterministic jobs run a data-only rule engine. Register `lab://secure-agent`, `lab://vulnerable-agent`, or `lab://incomplete-agent`. Unknown, malformed, traversal-like, or unsupported-version fixtures fail closed. Adaptive and hybrid execution are implemented for their exact supported mappings.

The `agent-deployment/v1` manifest covers identity/capabilities, tools, operations, authorization/approval, resource scopes, credential references/redaction, network controls, and deployment controls. Missing or unknown values remain insufficient evidence.

| Rule | Deterministic condition |
|---|---|
| DET-001 | Explicit wildcard tool operations |
| DET-002 | Explicitly absent tool authorization |
| DET-003 | High-risk operations explicitly lack approval |
| DET-004 | Explicit wildcard resource scope |
| DET-005 | Credential material explicitly stored inline |
| DET-006 | Credential log redaction explicitly disabled |
| DET-007 | Public service explicitly lacks authentication |
| DET-008 | Deployment sandboxing explicitly disabled |

Evaluations are `passed`, `failed`, `not_applicable`, or `unknown`; only failures generate findings. Stable fingerprints use sanitized rule, target, resource, and evidence attributes. Findings represent configuration weaknesses, not demonstrated runtime exploits.

### M4 isolated agent laboratory

M4 adds a deterministic in-memory simulator for five synthetic tools: `read_document`, `search_knowledge_base`, `send_message`, `update_record`, and `execute_approved_action`. These names model behavior only: they perform no external reads, searches, delivery, operating-system execution, cloud calls, or persistent writes.

Authenticated operators can list, run, and reset exact predefined scenarios through `/api/v1/lab/scenarios`, `/api/v1/lab/runs`, and `/api/v1/lab/reset`. Requests cannot provide tool actions or policies. Sixteen development scenarios provide secure and vulnerable variants for eight objectives; a separate held-out registry is excluded from ordinary execution.

Each `lab-scenario/v1` fixture contains agent identity/objective, policies, synthetic resources, controlled actions, expected decisions/outcome/evidence, an independently derived vulnerability label, and reset instructions. `lab-trace/v1` exports ordered decisions and simulated outcomes with sensitive values redacted. Runs are limited to 20 steps, one second, and 128 KiB of evidence, and all in-memory state is discarded afterward.

### M5 adaptive security assessment

Adaptive jobs now execute through separate planner, provider, validator, laboratory adapter, evidence evaluator, and finding normalizer components. Supported probe classes cover prompt injection, unauthorized tool use, approval bypass, cross-scope access, sensitive disclosure, tool-output injection, role manipulation, and multi-step influence.

The default `mock` provider is deterministic and offline. It supports reproducible structured probe sequences plus predefined error, timeout, and malformed-response outcomes for tests. An optional OpenAI-compatible adapter reads its endpoint, key, and model exclusively from server environment variables and is never selected unless `ADAPTIVE_PROVIDER=openai_compatible` is set explicitly. The real adapter has not been tested because no authorized credentials were available; mock results do not establish real-model prompt-injection vulnerability.

Adaptive scans support `simulator` and `model_mediated` execution labels. A model-mediated proposal is treated as untrusted and still passes through the closed scenario validator and independent M4 tool gateway. A mock-provider model-mediated run validates plumbing only.

Findings require an observed successful prohibited action or disclosure in a sanitized trace. Model claims or suggested tool calls never establish success. Results report confirmed violation, no violation observed, or inconclusive; execution errors remain failed jobs with error codes. Default budgets are four probes, 1,024 provider tokens, five seconds, and the existing worker timeout.

### M6 hybrid findings correlation

Hybrid jobs run the deterministic component and then the adaptive component against an exact, reviewed fixture-to-scenario mapping. M6 supports `lab://secure-agent` and `lab://vulnerable-agent`; unknown or ambiguous mappings fail closed. The default adaptive provider remains the deterministic offline mock.

The versioned correlation engine uses explicit DET rule-to-adaptive probe mappings and exact resource/objective criteria, never unrestricted text similarity. It reports corroborated, configuration-only, behavior-only, contradictory/mitigating, inconclusive, and uncorrelated evidence. A `no_violation_observed` result is mitigating evidence for the tested action, not proof that the target is secure.

Unified findings retain references to the original deterministic findings, adaptive findings, probes, and observed outcomes. Stable fingerprints provide deterministic deduplication and ordering. Configuration severity is not automatically raised by agreement; evidence strength is represented by the correlation outcome. If either required component fails or times out, the job is failed with a persisted partial report and any safe completed evidence. Ground-truth labels are not available to normal hybrid execution, and M6 makes no comparative-effectiveness claim.

### M7 controlled comparative evaluation

M7 adds a frozen, independently labeled five-case/eight-objective evaluation corpus and a ground-truth-isolated harness for C1 deterministic, C2 adaptive, and C3 hybrid conditions. Scanner execution receives only exact closed fixture/scenario mappings; labels enter only during post-execution scoring. Vulnerability instances are matched through enumerated rule/probe identifiers, and duplicate findings count once.

The prospective protocol specifies eligibility, undefined metrics, failures, three repetitions, rotating condition order, descriptive analysis, and threats to validity. Pilot artifacts are separated from the final `m7-final-001` study. Machine-readable raw/scored results, CSV metrics, manifests, SHA-256 hashes, failures/exclusions, comparative summary, and limitations are under `research/experiments`.

The final controlled simulation completed all 45 runs. Eligibility-adjusted case-level precision, recall, F1, evidence coverage, completion, and detected-set reproducibility were 1.0 for all conditions, with zero observed false positives. These values describe only the deliberately constrained synthetic corpus: C1 covered 31 eligible units, C2 only 6, and C3 32. They do not demonstrate statistical superiority, production effectiveness, or real-model prompt-injection detection. No inferential test was performed because the small purposive corpus and deterministic mock repetitions do not support it.

### M8 final handover

M8 performs no new detection or research experiment. It audits implemented claims, maps requirements to code/tests/evidence, documents the actual interfaces and five-migration schema, records residual security/deployment risks, and supplies reproducibility, deployment and supervisor-demonstration runbooks.

Start with:

- `docs/traceability.md` for verified, partial, unverified and out-of-scope requirements.
- `docs/technical-reference.md` for interfaces, schema, engines and troubleshooting.
- `docs/security-review.md` for confirmed controls and residual risks.
- `docs/deployment-runbook.md` for configuration and operational readiness.
- `docs/reproducibility.md` for tested setup and frozen-study verification.
- `research/HANDOVER.md` for the academic methodology, results and interpretation.
- `docs/supervisor-demo.md` for the demonstration sequence.

## 5. Key functional requirements

| ID | Requirement | MVP priority |
|---|---|---|
| FR-01 | Register a target with ownership/authorization metadata and allowlisted endpoint(s) | Must |
| FR-02 | Start deterministic, adaptive, or hybrid scan jobs | Must |
| FR-03 | Expose job lifecycle: queued, running, completed, failed, cancelled | Must |
| FR-04 | Evaluate supported configuration and agent permission rules | Must |
| FR-05 | Execute bounded, controlled adaptive tests against lab targets | Must |
| FR-06 | Capture observable outcomes and sanitized supporting evidence | Must |
| FR-07 | Normalize and deduplicate findings from different scanning methods | Must |
| FR-08 | Classify findings with severity, confidence, affected asset, and remediation | Must |
| FR-09 | Persist scans, findings, configurations, and reproducibility metadata | Must |
| FR-10 | Display scan history, findings, and comparison summaries | Must |
| FR-11 | Export structured JSON/CSV reports | Must |
| FR-12 | Support versioned research corpus and comparative experiment runs | Must |
| FR-13 | Require approval for high-risk active tests beyond the lab | Later / explicit authorization |
| FR-14 | Optional CI/CD quality gate and PDF reporting | Later |

## 6. Non-functional and security requirements

- **Safety:** Default deny for unknown targets; no internet-wide discovery; allowlist endpoints and tool operations; sandbox test execution; use synthetic data.
- **Least privilege:** Scanner and lab containers run without privileged mode, host Docker socket, or broad host mounts; use bounded filesystem/network access.
- **Secrets:** No secrets committed to Git; use environment injection or a secret store; redact tokens and sensitive payloads from logs and reports.
- **Auditability:** Record who initiated each scan, target authorization, scanner version, test configuration, timestamps, actions, and outcome.
- **Reliability:** Enforce timeouts, concurrency limits, retry bounds, cancellation, and idempotent job handling.
- **Integrity:** Version the vulnerability corpus, test harness, rules, model configuration, and report schema; retain evidence hashes where useful.
- **Reproducibility:** Record random seeds where supported, model/provider versions, prompts or templates, parameters, container image digests, and environment details.
- **Privacy:** Avoid retaining real client content; apply retention and redaction controls.
- **Usability:** Findings must explain what was observed, why it matters, how to reproduce safely, and recommended remediation.
- **Performance:** Measure scan latency and resource usage; establish quantitative thresholds after a baseline pilot, not by guessing.

## 7. Assessment and evidence model

A normalized finding should minimally include:

```json
{
  "finding_id": "example-001",
  "scan_id": "example-scan-001",
  "source": "deterministic",
  "category": "excessive_tool_permissions",
  "asset": "sandbox-agent/tool/read_document",
  "severity": "high",
  "confidence": "confirmed",
  "summary": "Illustrative finding; not an actual scan result",
  "evidence": [{"type": "sanitized_observation", "reference": "artifact-id"}],
  "remediation": "Restrict tool access to authorized documents"
}
```

Define schemas formally before implementing service integration. Distinguish **attempted** unauthorized actions from **successful** unauthorized access. Severity and confidence are separate fields. The hybrid engine must not inflate certainty merely because multiple scanners agree.

## 8. Research and evaluation plan

### Conditions

- **C1 — Deterministic only**
- **C2 — Adaptive only**
- **C3 — Hybrid**

Use the same versioned corpus and target configurations across conditions. Include secure negative controls, known vulnerabilities, and where feasible held-out scenarios not used during scanner development. Establish ground truth independently of the scanner being evaluated.

### Metrics

- True positives, false positives, false negatives, true negatives.
- Precision = TP / (TP + FP), when denominator is nonzero.
- Recall = TP / (TP + FN), when denominator is nonzero.
- False-positive rate = FP / (FP + TN), when denominator is nonzero.
- Scan duration, compute/API cost, repeatability, and finding evidence quality.

Run adaptive tests repeatedly and report variability. A detection is **confirmed** only if a predefined observation or validated artifact supports it; model-generated explanations alone are not ground truth. Publish methodology and limitations alongside results.

### Initial vulnerability families (to validate with mentor)

1. Excessive agent tool permissions or overbroad delegated access.
2. Missing tool-side authorization checks.
3. Secrets in supported configuration or source artifacts.
4. Unsafe deployment/network exposure in supported manifests.
5. Prompt injection inducing attempted or actual unauthorized tool use.
6. Sensitive data disclosure in synthetic test environments.

## 9. Delivery milestones

| Milestone | Deliverable | Acceptance gate | Status |
|---|---|---|---|
| M0 — Baseline | README, requirements draft, architecture and decisions | Scope and assumptions documented | Complete |
| M1 — Bootstrap | Monorepo, Compose, web/API/scanner/Supabase integration skeleton | All services start; health checks pass | Complete |
| M2 — Scan orchestration vertical slice | Constrained target registry, durable scan lifecycle, mock scanner dispatch, persisted results, dashboard | End-to-end lifecycle plus cancellation, retry, leasing, and recovery tests pass | Complete |
| M3 — Deterministic | Agent-specific rules, trusted fixture registry, persistence, and reporting | Known secure/vulnerable fixtures classified and end-to-end findings displayed | Complete |
| M4 — Lab | Isolated deterministic simulator, synthetic tools/data, ground-truth corpus | Secure/vulnerable scenarios repeatable with redacted traces | Complete |
| M5 — Adaptive | Bounded evidence-first adaptive planner, providers, lab execution, persistence, and reporting | Mock-provider workflow verified; real provider explicitly unverified | Complete |
| M6 — Hybrid | Explicit deterministic/adaptive correlation, provenance, partial reports, and dashboard | Traceable cross-scanner results | Complete |
| M7 — Evaluation | Frozen protocol/corpus, isolated C1/C2/C3 runner, scoring, artifacts, and descriptive analysis | Metrics and limitations documented | Complete |
| M8 — Handover | Traceability, validation, security/deployment/reproducibility guides, research handover and demo | Reproducible setup and final review | Complete; awaiting final review |

## 10. Development workflow and AI IDE agent instructions

**The README is a living entry point. Every implementation session must begin by reading it**, followed by `docs/requirements.md`, `docs/architecture.md`, and `docs/progress.md` when those files exist.

For each meaningful task, the IDE agent must:

1. **Check the current milestone and scope.** Do not silently add new features, change research methodology, or widen authorized targets.
2. **Propose a small implementation plan** and identify impacted files/contracts before making changes.
3. **Implement incrementally** with tests, input validation, meaningful errors, and secure defaults.
4. **Run relevant checks** (format, lint, type checks, tests, service health/integration tests); report what actually ran and what could not run.
5. **Update documentation in the same change:**
   - `README.md`: current milestone/status, meaningful capability changes, setup/run instructions, and next steps.
   - `docs/progress.md`: date, work completed, test evidence, blockers, next action.
   - `docs/requirements.md`: requirement statuses and acceptance criteria when changed.
   - `docs/architecture.md` or `docs/decisions/`: architectural changes and rationale.
6. **Do not fabricate progress, metrics, tests, or approvals.** Mark uncertain assumptions and mentor-dependent decisions explicitly.
7. **Keep the scientific comparison fair.** Do not modify the ground truth or evaluation criteria after seeing results without documenting the protocol change.
8. **Protect research artifacts.** Do not overwrite experiment results; assign run IDs and preserve reproducibility metadata.
9. **Avoid scope creep.** Finish the current milestone before adding optional tools, providers, or infrastructure.
10. **Summarize at the end of each session:** implemented, verified, outstanding, documentation updated, and recommended next task.

## 11. Decisions pending technical review

- Production identity/RBAC and attributable authorization records.
- Approved real-model provider, data-processing terms, endpoint and experimental protocol.
- Evidence retention, deletion, encryption and access policy.
- Hosted monitoring, rate limiting, egress control, backup/restore and incident response.
- A larger independently reviewed evaluation corpus and appropriate future statistical design.
- CTRL F2 case-study authorization, scope and data-use approval.

These are blockers to broader deployment or stronger research claims, not to the completed isolated academic prototype.

## 12. Current status and next action

**Current status:** M1–M8 are complete for the isolated academic prototype. Final regression validation passed locally, documentation is traceable to implementation/evidence, the academic handover and supervisor demo are prepared, and frozen M7 hashes remain unchanged. The optional real provider, hosted Supabase deployment, production identity/operations and external security assessment remain unverified.

**Next action:** Conduct the supervisor/final review using `docs/supervisor-demo.md`. Resolve the blockers in `docs/traceability.md` before any deployment expansion. No production deployment is authorized by this handover.

---

**Documentation rule:** Update this README whenever a milestone changes or a user-visible capability is added. Keep detailed work logs in `docs/progress.md`; do not turn the README into an unstructured chronological transcript.
