# Hybrid Vulnerability Assessment Framework for Secure Autonomous AI Agents

> **Research title:** A Hybrid Vulnerability Assessment Framework for Secure Autonomous AI Agents using CTRL F2  
> **Status:** Planning / implementation kickoff  
> **Organization:** CTRL F2 (proposed case-study environment; access and scope require explicit authorization)  
> **Document role:** Living project overview and progress index. The repository's requirements, architecture, decisions, and experiments provide the detailed source of truth.

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
Fastify/TypeScript API  <----> PostgreSQL
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

### Technology choices (provisional)

| Layer | Choice | Purpose |
|---|---|---|
| Web | React + TypeScript + Tailwind CSS | Assessment dashboard |
| API | Node.js + TypeScript + Fastify | Authentication, targets, jobs, reporting API |
| Scanner | Python + FastAPI | Deterministic and adaptive assessments |
| Persistence | PostgreSQL | Scan jobs, targets, findings, experiment metadata |
| Orchestration | Docker Compose | Local development and isolated services |
| Lab target | Minimal TypeScript or Python AI agent (TBD) | Controlled security scenarios |
| Deterministic tools | Custom rules first; evaluate Semgrep, Checkov, Gitleaks | Supported static/configuration checks |
| Adaptive model | Provider interface; hosted or local model TBD | Generate/adapt bounded test cases |
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

Create directories and files incrementally as implementation reaches them; this layout is a plan, not a claim that code already exists.

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
| M0 — Baseline | README, requirements draft, architecture and decisions | Scope and assumptions documented | **In progress** |
| M1 — Bootstrap | Monorepo, Compose, web/API/scanner/Postgres skeleton | All services start; health checks pass | Not started |
| M2 — Vertical slice | API creates scan, scanner returns fixture result, DB stores it, UI displays it | End-to-end test passes | Not started |
| M3 — Deterministic | Agent-specific rules and unit tests | Known secure/vulnerable fixtures classified | Not started |
| M4 — Lab | Isolated agent target, synthetic tools/data, ground-truth corpus | Test scenarios repeatable | Not started |
| M5 — Adaptive | Bounded model-assisted tests and evidence capture | Observable outcomes logged; repeated runs supported | Not started |
| M6 — Hybrid | Finding normalization, validation, deduplication, severity | Traceable cross-scanner results | Not started |
| M7 — Evaluation | C1/C2/C3 experiments and analysis | Metrics and limitations documented | Not started |
| M8 — Handover | Documentation, deployment instructions, demo | Reproducible setup and final review | Not started |

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

### Suggested first IDE-agent task

> Read this README and treat it as the project baseline. Initialize M1 only: create the minimal monorepo with React/TypeScript web, Fastify/TypeScript API, FastAPI/Python scanner, PostgreSQL, Docker Compose, versioned API contracts, environment examples, and basic tests. Implement health endpoints and verify API-to-scanner HTTP/JSON communication. Use secure defaults and no real scan targets. Create `docs/requirements.md`, `docs/architecture.md`, and `docs/progress.md`. Do not implement vulnerability scanning, authentication shortcuts, or LLM integration yet. Run available checks, document exact commands and results, and update this README and progress log before finishing.

## 11. Decisions pending technical review

- Exact AI agent framework and supported deployment formats for the MVP.
- Hosted vs local LLM provider, model, data handling, and budget.
- Initial deterministic scanner integrations versus custom-only rules.
- The vulnerability corpus size and final test taxonomy.
- Authentication/authorization approach for single-researcher local use vs multi-user deployment.
- Job queue mechanism if HTTP-based orchestration becomes insufficient.
- CTRL F2 case-study scope, access approvals, and data-use permissions.

These are **open decisions**, not blockers to bootstrapping the application skeleton.

## 12. Current status and next action

**Current status:** README baseline created; implementation not yet started. Supervisor-approved research direction; mentor review of the SRS and organizational arrangements may still be pending.

**Next action:** Initialize the repository and complete **M1 — Bootstrap** with a running Docker Compose stack, service health endpoints, typed API-to-scanner communication, and passing smoke tests.

---

**Documentation rule:** Update this README whenever a milestone changes or a user-visible capability is added. Keep detailed work logs in `docs/progress.md`; do not turn the README into an unstructured chronological transcript.
