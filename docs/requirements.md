# Requirements and acceptance criteria

Status values are **not started**, **in progress**, and **verified**. A requirement is only verified after its acceptance evidence has run successfully.

## Milestone M1 — Project Bootstrap

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| M1-01 | Monorepo structure | React web, Fastify API, shared contracts, and FastAPI scanner have independent build/test configuration | Verified |
| M1-02 | Service communication | The web calls the API status endpoint; the API calls the scanner health endpoint over REST/JSON | Verified |
| M1-03 | Managed database configuration | Only the API reads `DATABASE_URL`; Drizzle owns schema/migrations; TLS validation defaults on | Verified |
| M1-04 | Initial migration | A reproducible Drizzle migration creates the initial metadata table | Verified |
| M1-05 | Local orchestration | Default Compose starts web/API/scanner with health checks and no PostgreSQL container | Verified |
| M1-06 | Secure defaults | Non-root containers, dropped capabilities, read-only filesystems, bounded requests, restricted CORS, and placeholder-only environment examples | Verified |
| M1-07 | Automated checks | Type checks, unit tests, builds, Python lint/tests, Compose validation, and service smoke tests pass | Verified |
| M1-08 | Scope boundary | No vulnerability scanning, LLM integration, Supabase Auth, Storage, or Realtime is implemented | Verified |

## MVP functional requirements

The functional requirements FR-01 through FR-14 in README.md remain **not started**. M1 supplies infrastructure only and does not claim to implement assessment behavior.

## Security acceptance notes

- `DATABASE_URL` is server-only and must never use the `VITE_` prefix.
- The scanner receives no database credential and has no database dependency.
- Hosted database migration verification requires an operator-provided Supabase `DATABASE_URL`; no credential is stored in this repository.
- A future local integration database must be opt-in and must not be added to the default Compose configuration.

