# Architecture

## M1 component boundaries

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

The browser receives only the API base URL. The Fastify API is the sole owner of application persistence, Drizzle schema definitions, and migrations. The scanner is intentionally stateless in M1 and communicates only with the API through internal HTTP endpoints.

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

No scanning operation, target registration, LLM call, or database write is present in M1.

## Trust assumptions

- Operators provide a correctly scoped Supabase role and rotate credentials outside the repository.
- Production and research/experimental Supabase projects or schemas remain separate.
- TLS certificate verification stays enabled for externally hosted PostgreSQL.
- Only explicitly authorized synthetic targets will be introduced in later milestones.

