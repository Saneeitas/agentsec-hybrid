# ADR-0004: Closed fixture registry and data-only deterministic rule engine

- Status: Accepted
- Date: 2026-10-21

## Context

M3 must assess authorized laboratory deployments reproducibly without converting a fixture identifier into arbitrary filesystem or network access. Findings must be explainable and must never depend on an LLM or expose secret values.

## Decision

- Resolve exact `lab://` identifiers through a versioned, packaged allowlist; never accept a path or URL from a request.
- Validate bounded JSON manifests against the strict `agent-deployment/v1` model before evaluation.
- Treat manifests only as data. Do not execute embedded code or evaluate target-supplied expressions.
- Implement DET-001 through DET-008 as pure, ordered predicates with explicit passed, failed, not-applicable, and unknown outcomes.
- Emit findings only for failed rules with sufficient evidence. Build stable fingerprints from canonical sanitized attributes.
- Keep the scanner stateless. The Fastify API owns job, evaluation, and finding persistence.

## Consequences

The fixture corpus is safe and reproducible, but adding a fixture requires a reviewed code change. Unknown or invalid configuration produces an explicit non-success result rather than speculative findings. This development corpus is not a held-out research evaluation dataset.
