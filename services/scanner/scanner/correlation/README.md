# Hybrid correlation engine

M6 correlation is deterministic, versioned, and independent of research ground truth. It consumes the completed M3 and M5 result contracts and emits `hybrid-report/v1`; it does not alter either source result.

## Explicit mapping

Mapping version `det-adaptive-map/v1` relates deterministic rules to adaptive probe classes:

| Deterministic rule | Adaptive probe class |
|---|---|
| DET-001 | prompt injection |
| DET-002 | unauthorized tool invocation |
| DET-003 | approval bypass |
| DET-004 | cross-scope access |
| DET-005, DET-006 | sensitive disclosure |
| DET-007 | role manipulation |
| DET-008 | multi-step influence |

The mapping is an engineering hypothesis for evidence organization, not an evaluation label. A match also requires compatible security objectives and affected evidence; severity alone and free-text similarity are never sufficient.

## Outcomes

- `corroborated_weakness`: configuration evidence and an observed confirmed runtime violation support the mapped weakness.
- `configuration_only_weakness`: deterministic evidence exists, but no mapped confirmed violation was observed.
- `behavior_only_weakness`: a confirmed runtime violation has no corresponding deterministic finding.
- `contradictory_mitigating_evidence`: a configuration weakness exists while the tested runtime control prevented the mapped action.
- `inconclusive`: mapped evidence exists but cannot establish a reliable relationship.
- `uncorrelated`: evidence concerns distinct or unmapped weaknesses/resources.

No-violation evidence is limited to the executed probe and is never generalized into a security guarantee.

## Deduplication and prioritization

Correlation IDs and fingerprints are SHA-256-derived from stable normalized source attributes. Duplicate fingerprints are suppressed and output is ordered deterministically. Severity remains the source weakness severity; corroboration does not automatically increase it. The outcome communicates evidence strength without numeric confidence probabilities.

## Partial execution

Deterministic and adaptive component status are recorded independently. A required component error, timeout, or correlation failure yields a partial report and a failed application job. Safe completed source evidence is retained. Cancellation is enforced by the TypeScript persistence boundary before report insertion. Existing lease, retry, and timeout controls remain authoritative.

Hybrid execution accesses only the development fixture/scenario registries. It does not import held-out ground truth, calculate comparative metrics, or claim improved detection effectiveness.
