# ADR-0007: Explicit evidence-preserving hybrid correlation

- Status: Accepted
- Date: 2026-10-21

## Context

M6 must relate configuration findings to observed behavior without concatenating results, using unrestricted similarity, inflating certainty, or consuming evaluation ground truth.

## Decision

- Execute deterministic and adaptive components independently for an exact reviewed target mapping.
- Correlate only through a versioned DET-rule to adaptive-probe mapping and explicit component/resource criteria.
- Preserve original component results and reference them from immutable unified findings.
- Represent evidence strength as corroborated, configuration-only, behavior-only, mitigating, inconclusive, or uncorrelated. Keep it separate from vulnerability severity.
- Use canonical sanitized provenance to derive stable SHA-256 correlation fingerprints and deterministic ordering.
- A component failure produces a partial report, persists safe completed evidence, and terminates the job as failed with `hybrid_partial_failure`.
- Do not access M4 ground-truth labels or held-out scenarios during detection or correlation.

## Consequences

Correlation is auditable and reproducible but intentionally limited to documented mappings. Absence of a runtime violation is not proof of security. New relationships require reviewed mapping changes and a correlation-engine version increment. Hybrid reports do not establish improved effectiveness; that claim requires M7 experiments.
