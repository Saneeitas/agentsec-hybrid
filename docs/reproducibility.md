# Reproducibility guide and checklist

This guide is for an authorized researcher using synthetic fixtures. It preserves the frozen M7 final study and writes verification output only to temporary directories.

## Environmental assumptions

- Node.js 22+ and npm.
- Python 3.12+; M7 final ran on Python 3.13.3.
- Docker Engine with Compose.
- Git and SHA-256 tooling (`shasum -a 256` on macOS or `sha256sum` on Linux).
- A compatible PostgreSQL database. Hosted Supabase is intended but unverified; a disposable PostgreSQL 16 container may be used for local integration.
- Loopback ports 3000 and 5173 free; local integration example also uses 55432.

## Clone, install and configure

```bash
git clone <authorized-repository-url>
cd Agentic-security-framework
npm install
python3 -m venv .venv
.venv/bin/pip install -e './services/scanner[dev]'
cp .env.example .env
```

Set `DATABASE_URL`, keep `DATABASE_SSL=true` for Supabase, and generate distinct `API_AUTH_TOKEN` and `SCANNER_SERVICE_TOKEN` values. Do not commit `.env`.

## Disposable local PostgreSQL verification

The following is optional and must not be added to default Compose:

```bash
docker run -d --name asf-repro-postgres \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=asf_test \
  -p 127.0.0.1:55432:5432 postgres:16-alpine

DATABASE_URL=postgresql://postgres:testpass@127.0.0.1:55432/asf_test \
DATABASE_SSL=false npm run db:migrate

TEST_DATABASE_URL=postgresql://postgres:testpass@127.0.0.1:55432/asf_test \
npm run test:integration --workspace=@asf/api
```

Remove only this named disposable container when finished: `docker rm -f asf-repro-postgres`.

## Start and operate the platform

```bash
npm run typecheck
npm test
.venv/bin/pytest services/scanner
.venv/bin/ruff check services/scanner research/evaluation
npm run build
npm audit
docker compose config --quiet
docker compose up --build --wait
```

Use the dashboard to:

1. Enter the operator token.
2. Register `secure-agent` or `vulnerable-agent` (the UI adds `lab://`).
3. Select deterministic, adaptive or hybrid mode.
4. Keep adaptive execution on simulator for the verified offline workflow.
5. Inspect status, findings, evidence, remediation and hybrid provenance.
6. Cancel queued/running jobs using the displayed action.

The equivalent API workflow uses `POST /api/v1/targets`, `POST /api/v1/scans` and repeated `GET /api/v1/scans/:id` calls with the operator bearer token. See `docs/technical-reference.md`.

## Verify frozen M7 integrity

Do not rerun into `research/experiments/m7-final` and do not edit the protocol, corpus or final files. Verify:

```bash
shasum -a 256 research/datasets/evaluation-corpus-v1.json
shasum -a 256 research/protocols/m7-evaluation-protocol-v1.md
jq -r '.corpusSha256, .protocolSha256' \
  research/experiments/m7-final/run-manifest.json
```

Expected corpus hash: `fd914d995c090140d88dcf4e8b5119f55402eda216953526c8309901096f177d`.

Expected protocol hash: `a1344722eb8e08ba56e5ac8b58145527982d2f5a6fce6449c9867ca7bc01bdf8`.

## Reproduce evaluation behavior without overwriting evidence

Use a temporary output directory and a distinct verification study ID:

```bash
M8_EVAL_OUTPUT="$(mktemp -d)"
.venv/bin/python research/evaluation/run_evaluation.py \
  --phase final \
  --study-id m8-reproduction-check \
  --repetitions 3 \
  --output "$M8_EVAL_OUTPUT"
jq '.C1.caseLevelMetrics, .C2.caseLevelMetrics, .C3.caseLevelMetrics' \
  "$M8_EVAL_OUTPUT/metrics.json"
```

Run IDs, timestamps, durations and raw-result hashes differ from the frozen study because the study ID and execution time differ. The expected controlled result shape is 45 completed runs, zero failures, the same case-level confusion counts and 1.0 detected-set reproducibility. Delete the temporary directory after review.

## Checklist

- [ ] Repository revision recorded.
- [ ] Node, npm, Python, Docker and PostgreSQL versions recorded.
- [ ] `.env` created locally and excluded from version control.
- [ ] Distinct operator/service tokens configured.
- [ ] TLS enabled for any hosted PostgreSQL endpoint.
- [ ] Migrations `0000`–`0004` applied successfully.
- [ ] Python, TypeScript, API, dashboard and PostgreSQL tests passed.
- [ ] Build, audit and Compose validation passed.
- [ ] All three containers reached healthy status.
- [ ] Deterministic, adaptive mock and hybrid synthetic scans completed.
- [ ] M7 corpus/protocol hashes matched the frozen manifest.
- [ ] Reproduction wrote to a temporary directory, not frozen artifacts.
- [ ] Supabase and real-provider verification accurately marked verified or unverified.
