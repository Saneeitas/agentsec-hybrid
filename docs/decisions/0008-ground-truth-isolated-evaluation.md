# ADR-0008: Ground-truth-isolated comparative evaluation

- Status: Accepted
- Date: 2026-10-21

## Context

M7 compares three assessment conditions without allowing scanner decisions to consume evaluation labels. Raw findings differ in shape, and repeated deterministic mock runs are not independent observations.

## Decision

- Keep the frozen evaluation corpus under `research/datasets`, separate from development fixtures and scanner decision modules.
- Pass only closed manifest/scenario mapping references into existing engines; expose labels only to a post-execution scorer.
- Score predefined case/objective instances using explicit rule/probe identifiers and hybrid source provenance, never free-text similarity.
- Treat method-ineligible, inconclusive, partial, failed, timed-out, and cancelled units separately from ordinary negatives.
- Count each ground-truth instance at most once, regardless of duplicate source findings.
- Export raw outputs, scored rows, metrics, manifests, failures/exclusions, hashes, and limitations as file artifacts rather than adding application-database coupling.
- Characterize mock-provider repetitions as controlled repeatability checks, not independent stochastic samples.

## Consequences

Evaluation can be reproduced without Supabase and cannot silently tune scanner logic from labels. The small purposive synthetic corpus supports descriptive findings only. Real-model or broader statistical evaluation requires a separately frozen protocol extension.
