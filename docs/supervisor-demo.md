# Supervisor demonstration script

Target duration: 15–20 minutes. Use only synthetic fixtures and the offline mock provider.

## Preparation

1. Confirm the disposable/local PostgreSQL database is available and migrations `0000`–`0004` are applied.
2. Set distinct temporary operator and scanner tokens; keep `ADAPTIVE_PROVIDER=mock`.
3. Run `docker compose up --build --wait` and `docker compose ps`.
4. Verify `GET /health` and `/api/v1/status`.
5. Do not edit or rerun into `research/experiments/m7-final`.

## Architecture walkthrough — 2 minutes

Explain the boundary: React is presentation; Fastify authenticates, owns PostgreSQL and leases jobs; FastAPI is stateless and executes closed fixtures; the M4 lab has only synthetic tools; M7 is a separate file-based scorer. Point out that the scanner never receives `DATABASE_URL` and the browser never receives credentials.

## Deterministic demonstration — 3 minutes

1. Enter the operator token.
2. Register `lab://vulnerable-agent` through the dashboard.
3. Start a deterministic scan and show queued → running → completed.
4. Explain the eight rules:
   - DET-001 wildcard operations.
   - DET-002 absent authorization.
   - DET-003 missing privileged-action approval.
   - DET-004 wildcard resource scope.
   - DET-005 inline credential material.
   - DET-006 disabled credential redaction.
   - DET-007 public service without authentication.
   - DET-008 disabled sandboxing.
5. Show affected resource, sanitized evidence and remediation. State that these are configuration weaknesses, not demonstrated exploits.

## Adaptive demonstration — 3 minutes

1. Start an adaptive simulator scan for the vulnerable fixture.
2. Show probe count, mock provider/model metadata and `confirmed_violation`.
3. Explain that the proposal passes through strict validation and the M4 tool gateway.
4. Show the authorization decision/outcome evidence.
5. State explicitly: the mock provider validates deterministic orchestration and evidence handling; it does not demonstrate a real model's prompt-injection vulnerability.

## Hybrid demonstration — 3 minutes

1. Start a hybrid simulator scan.
2. Show deterministic/adaptive/correlation component status.
3. Explain corroborated, configuration-only, behavior-only, mitigating and inconclusive outcomes.
4. Open source finding/probe references and correlation rationale.
5. Explain that severity and evidence strength are separate and that source evidence is not overwritten.

## M7 protocol and results — 4 minutes

1. Show the frozen protocol and corpus manifest hashes.
2. Explain five cases, eight objectives, condition eligibility and ground-truth isolation.
3. Show `research/experiments/m7-final/comparative-summary.md` and `metrics.json`.
4. Report 45/45 completed runs and the exact case-level table.
5. Emphasize differing denominators: C1 31, C2 6, C3 32.
6. State that no superiority/significance claim is supported; this is a small controlled deterministic-mock simulation.

## Limitations and close — 2 minutes

- Supabase hosted connectivity/migrations unverified.
- Real provider unverified.
- Shared-token local authentication is not production identity.
- No rate limiting, full observability, retention automation or restore drill.
- Docker is defense in depth, not complete isolation.
- No CTRL F2 or production system was scanned.

Close by distinguishing completed engineering—closed synthetic assessment lifecycle, persistence, evidence, correlation and reproducible evaluation—from outstanding deployment hardening and broader empirical research.

## Demo recovery notes

- If a target already exists, reuse it rather than creating a duplicate.
- If a job fails, retain and show the failure; do not conceal or manually rewrite it.
- If Compose cannot reach PostgreSQL, demonstrate preserved M7 artifacts and architecture only; do not disable TLS for a hosted database.
- Stop services with `docker compose down`; remove only explicitly named disposable test containers.
