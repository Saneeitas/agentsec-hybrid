# ADR-0005: Stateless closed-registry agent laboratory

- Status: Accepted
- Date: 2026-10-21

## Context

M4 needs observable simulated agent behavior without executing target code or giving tools real-world capabilities. Ground truth must remain independent of scanner output.

## Decision

- Implement a deterministic Python simulator using only reviewed `lab-scenario/v1` data.
- Provide five fixed mock-tool types backed by per-run synthetic in-memory resources.
- Resolve exact scenario IDs through separate development and held-out registries; request bodies cannot supply actions, policies, paths, or URLs.
- Start every run from the immutable fixture and discard state afterward. Reset validates the scenario and confirms that next execution starts from its fixture baseline.
- Enforce step, runtime, trace, and serialized-output bounds and redact sensitive resource values.
- Author expected decisions, observable outcome, evidence, and vulnerability labels in the corpus independently of simulator or scanner results; tests compare execution to those labels.
- Expose the simulator through scanner-service authentication and an operator-authenticated Fastify proxy. Do not persist M4 runs in application tables.

## Consequences

Runs are reproducible and have no real tool side effects. Stateless reset is explicit but does not restore external state because none exists. Docker adds process and network boundaries but is not claimed as a complete sandbox; safety primarily comes from absent dangerous capabilities and closed data registries.
