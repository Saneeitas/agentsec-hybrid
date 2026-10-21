# ADR-0002: PostgreSQL-backed scan job leasing

- Status: Accepted
- Date: 2026-10-20

## Context

M2 needs durable asynchronous dispatch, bounded retries, cancellation, and recovery without introducing Redis, Kafka, or another infrastructure dependency. Multiple API/worker instances must not execute the same job concurrently.

## Decision

- Store the complete job lifecycle in PostgreSQL.
- Claim eligible jobs in a transaction using row locks with `FOR UPDATE SKIP LOCKED`, then assign a unique lease owner and expiry.
- Treat an expired running lease as recoverable work and record every state transition.
- Keep bounded worker concurrency per process, bounded HTTP execution time, finite attempts, and delayed retries.
- Run the worker alongside the API for M2, with the orchestration module kept separable for a future dedicated worker process.
- Persist mock results in application tables distinct from future research evidence.

## Consequences

PostgreSQL remains the only stateful infrastructure dependency and supplies atomic claims. Polling adds modest database traffic, controlled by a configurable interval. Per-process concurrency is bounded; aggregate concurrency scales with deliberately deployed worker instances. Scanner calls can be aborted immediately only by the owning process, while cross-process cancellation is enforced before result persistence and at lease recovery.

