# Deployment and operations runbook

This guide documents the implemented architecture. It does not authorize production deployment.

## Supported topology

The default Compose topology contains web, API and scanner services only. Web and API bind to loopback; scanner is internal. PostgreSQL must be provided separately. Supabase is used strictly as hosted PostgreSQL—no Supabase Auth, Storage or Realtime dependency exists.

## Required configuration

| Variable | Service | Requirement |
|---|---|---|
| `DATABASE_URL` | API/migrator | PostgreSQL URL; server-only |
| `DATABASE_SSL` | API/migrator | `true` for Supabase; `false` only for explicit local disposable DB |
| `API_AUTH_TOKEN` | API | Distinct random value, minimum 32 characters |
| `SCANNER_SERVICE_TOKEN` | API/scanner | Different random value, minimum 32 characters |
| `WEB_ORIGIN` | API | Exact browser origin allowed by CORS |
| `VITE_API_BASE_URL` | web build | Public API origin; must contain no credentials |

Worker and adaptive bounds are documented in `.env.example`. Keep `ADAPTIVE_PROVIDER=mock` unless a separately approved provider test is being conducted. Never commit `.env`.

Generate tokens using an approved password/secret generator. For a local Unix-like environment, `openssl rand -hex 32` is suitable if OpenSSL is trusted and available. Generate each token separately and store them in the deployment secret facility.

## Supabase readiness procedure

1. Create or select a non-production Supabase project dedicated to this research environment.
2. Obtain the appropriate direct or pooler PostgreSQL endpoint for the connection lifecycle. Confirm IPv4/IPv6 and network allowlist compatibility.
3. Use a least-privileged database role capable of the required schema migrations and application operations. Do not put the URL in frontend variables or logs.
4. Set `DATABASE_SSL=true`. Do not bypass certificate validation to work around connectivity.
5. From an authorized administrative environment, run `npm run db:migrate`.
6. Inspect that migrations `0000` through `0004` are present and run a non-production target/job smoke test.
7. Record endpoint type, role scope, migration output, timestamp and backup configuration without recording credentials.

This procedure has not succeeded against the hosted project in the current environment. Hosted connectivity and migrations remain a deployment blocker.

## Build and start

```bash
cp .env.example .env
# Edit .env with server-side values and distinct tokens.
npm install
python3 -m venv .venv
.venv/bin/pip install -e './services/scanner[dev]'
npm run typecheck
npm test
.venv/bin/pytest services/scanner
.venv/bin/ruff check services/scanner research/evaluation
npm run db:migrate
docker compose config --quiet
docker compose up --build --wait
```

Open `http://localhost:5173`. Enter `API_AUTH_TOKEN` in the dashboard. Stop with `docker compose down`.

## Health and readiness

- Web: `curl --fail http://127.0.0.1:5173/`
- API liveness: `curl --fail http://127.0.0.1:3000/health`
- API/scanner status: `curl --fail http://127.0.0.1:3000/api/v1/status`
- Container status: `docker compose ps`

These checks do not validate database readiness. A target/scan smoke test or explicit database query is required before relying on job processing.

## Logging and monitoring

The current Fastify logger is disabled and no metrics exporter exists. Container stdout and PostgreSQL transition rows are insufficient for production observability. Before broader deployment, add secret-safe structured logs for authentication failures, target/job mutation, scanner calls, retries, lease recovery and terminal outcomes; define request/job correlation IDs, latency/error metrics, alerts and retention. Never log tokens, `DATABASE_URL`, provider keys, inline credentials or raw sensitive evidence.

## Backup and recovery

- Enable and verify provider backups appropriate to the research risk and retention policy.
- Record migration version and repository revision with each backup.
- Test restore into an isolated project; do not test by overwriting the primary database.
- After restore, validate table counts, job/result relationships and a synthetic read-only report query before resuming workers.
- Application retries are not database disaster recovery. No backup or restore drill has yet been completed.

## Upgrade procedure

1. Back up the database and verify recovery metadata.
2. Review migrations and release changes; never edit already-applied migration files.
3. Stop worker/API processes to avoid mixed schema operation.
4. Apply forward migrations once.
5. Deploy scanner, API and web images from the same reviewed repository revision.
6. Check health and run secure/vulnerable synthetic smoke scans.
7. Roll back application images only if schema remains compatible; database rollback requires restoring a tested backup because down migrations are not supplied.

## Incident and troubleshooting operations

- Revoke/rotate both bearer tokens after suspected exposure; restart dependent services.
- Revoke provider/database credentials in their source system, not merely in `.env`.
- Stop workers before investigating repeated or unexpected scan execution.
- Preserve transition rows and sanitized evidence if needed for academic integrity or incident review.
- For a stuck job, inspect status, attempts, lease owner/expiry and scanner health. Do not manually mark completion without source evidence.
- For partial hybrid results, retain the report but treat the job as failed.
- For database errors, verify DNS, endpoint type, TLS and role grants. Never set `DATABASE_SSL=false` for hosted Supabase.

## Go-live decision

Production deployment is not ready. Required blockers include hosted database verification, identity/RBAC, rate limiting, observability, retention, backup/restore testing, egress controls and an authorized security review.
