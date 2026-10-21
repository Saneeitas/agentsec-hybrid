# ADR-0006: Evidence-first bounded adaptive assessment

- Status: Accepted
- Date: 2026-10-21

## Context

M5 introduces untrusted generated probes and optionally model-proposed actions. Textual model claims must never be treated as execution evidence, and adaptive behavior must not escape the M4 laboratory.

## Decision

- Separate planning, provider generation, validation, laboratory execution, evidence evaluation, and finding normalization behind versioned data contracts.
- Default to a deterministic offline mock provider. Offer an optional environment-configured OpenAI-compatible adapter with no embedded credential or required paid test.
- Map validated probes only to reviewed M4 development scenarios compatible with the registered `lab://` target.
- In model-mediated mode, treat a model's proposed scenario/tool intent as untrusted. The independent laboratory policy gateway remains authoritative.
- Confirm a violation only from a trace showing an allowed prohibited action or synthetic disclosure. Claims, refusals, and proposed calls alone are not violations.
- Bound probes, provider tokens, wall time, trace sizes, and job timeouts. Record selection rationale and sequence.
- Persist adaptive results/findings through Fastify-owned PostgreSQL tables. Keep deterministic and adaptive results separate until M6.

## Consequences

Offline tests are reproducible and cost-free, but they do not establish real-model susceptibility. The real adapter remains unverified until an explicitly authorized credentialed smoke test is performed and recorded. Closed scenario mapping limits coverage but preserves laboratory safety and reproducibility.
