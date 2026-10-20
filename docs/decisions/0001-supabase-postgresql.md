# ADR-0001: Supabase as managed PostgreSQL only

- Status: Accepted
- Date: 2026-10-20

## Context

The application needs managed PostgreSQL while preserving a clear service boundary and avoiding unnecessary platform coupling.

## Decision

- Use Supabase strictly as the managed PostgreSQL provider.
- Give the Fastify backend exclusive database access through Drizzle ORM and version-controlled migrations.
- Supply the connection string as server-side `DATABASE_URL`, with certificate-validating TLS enabled by default.
- Do not give the React frontend or Python scanner database credentials.
- Do not use Supabase Auth, Storage, Realtime, or other services without explicit approval.
- Do not run PostgreSQL in the default Compose project. A separate opt-in local configuration may be introduced for isolated integration tests.

## Consequences

The API remains the authorization and persistence boundary, and the scanner can be tested without database access. Local startup requires a valid managed database URL even though ordinary health checks do not query it. Applying and verifying migrations against Supabase remains an operator action requiring externally supplied credentials.

