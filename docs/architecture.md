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

