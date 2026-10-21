# ADR-0003: M2 operator and scanner bearer tokens

- Status: Accepted for the local research prototype
- Date: 2026-10-20

## Context

The repository has no identity provider, but M2 mutation and administrative endpoints must not be unrestricted. Supabase Auth is explicitly out of scope. The scanner endpoint is private in Compose but still requires application-layer authentication.

## Decision

- Require an operator bearer token for target and scan APIs.
- Let the local dashboard accept that token interactively and keep it in React memory only; do not compile it into the frontend or persist it in browser storage.
- Require a separate service bearer token for the scanner mock execution endpoint.
- Compare tokens in constant time and return generic authorization failures.
- Inject both secrets through environment variables; never commit them or log them.

## Consequences

This provides a clear local administrative boundary without adding an unapproved auth platform. It is not multi-user identity or role-based access control. A later deployment decision must replace or wrap it before exposing the application beyond the loopback-bound research environment.

