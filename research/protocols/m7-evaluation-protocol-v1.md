# M7 prospective evaluation protocol v1

- Protocol ID: `ASF-M7-PROTOCOL-001`
- Version: `1.0.0`
- Authored: 2026-10-21, before pilot or final execution
- Status: frozen after successful pilot validation
- Study type: controlled simulation using the deterministic mock provider
- Final repetition count: 3 per case and condition

## Research questions and hypotheses

RQ1 asks how C1 deterministic-only, C2 adaptive-only, and C3 hybrid assessment differ in eligibility-adjusted detection of independently labeled vulnerability instances. H1 is non-directional: at least one condition will differ in recall or evidence coverage. No superiority is assumed.

RQ2 asks how often each condition produces false positives on eligible secure instances. H2 is non-directional: false-positive rates may differ because each condition observes different evidence.

RQ3 asks about operational overhead and reproducibility. H3 predicts that C3 will take at least as long as either component because it executes both, while deterministic mock-provider repetitions will produce identical detected-instance sets. Runtime measurements remain descriptive.

## Conditions and unit of analysis

- C1 calls the existing M3 deterministic engine.
- C2 calls the existing M5 adaptive engine in simulator mode with the offline mock provider.
- C3 calls the existing M6 hybrid engine, which executes both components and the correlation engine.

The primary unit is one case/security-objective vulnerability instance, not one raw finding. A fixed objective catalog maps stable deterministic rule IDs and adaptive probe types to each unit. Multiple findings mapped to one unit count once. A raw finding count is never used as a TP count.

## Corpus, sampling, and inclusion

The purposive held-out corpus includes secure, shared/configuration-and-behavior, configuration-with-runtime-mitigation, behavior-only, incomplete/inconclusive, and multiple-weakness cases. Cases combine reviewed packaged manifests and reviewed M4 scenario variants through exact closed mappings. No arbitrary path, URL, action, policy, or code is accepted.

Labels are derived manually from explicit manifest fields and policy/action pairs, independently of scanner output. Each label states whether C1, C2, and C3 are eligible. A method that cannot observe the relevant evidence is `INELIGIBLE`, not a false negative. Inconclusive ground truth is excluded from confusion-matrix denominators and reported separately.

The development registry remains available for engineering tests. The evaluation corpus is stored separately under `research/datasets`, is not imported by deterministic, adaptive, or correlation decision code, and is supplied only to the post-execution scorer.

## Matching and outcome classification

Deterministic findings match only by an objective's enumerated rule ID. Adaptive findings match only through their executed probe's enumerated probe type. Hybrid findings are counted only when their preserved source references appear in a unified finding. Text similarity, severity, timestamps, and model assertions are not matching criteria.

For eligible conclusive units: vulnerable+detected = TP, vulnerable+not detected = FN, secure+detected = FP, secure+not detected = TN. Failed, timed-out, cancelled, incomplete, unsupported, ineligible, and ground-truth-inconclusive outcomes are retained separately and do not become negative assessments.

## Metrics

Primary metrics are case-level TP, FP, TN, FN, precision, recall, false-positive rate, F1, and evidence coverage. Secondary metrics are completion rate, mean wall-clock duration, provider tokens, available estimated cost, and repeated-run detected-set reproducibility. Overall run-level metrics are reported as descriptive operational checks but are not treated as independent samples.

Undefined denominators produce JSON `null` and blank CSV cells, never numeric zero. Eligibility-adjusted metrics exclude `INELIGIBLE`, `INCONCLUSIVE`, and execution failures. Provider cost is recorded as USD 0 only for the offline mock provider; no real-provider cost is inferred.

## Repetitions and order control

Each case/condition is run three times. Stable UUIDv5 run IDs derive from study, case, condition, and repetition. Condition order rotates by repetition: C1/C2/C3, C2/C3/C1, then C3/C1/C2. Cases retain lexical order. The engines use no random security decisions; generated trace UUIDs and timestamps do not affect matching. Repeated mock runs validate technical repeatability and are not independent stochastic observations.

## Failure handling

Every attempted run is exported. Exceptions become `execution_error`; partial hybrid results become `incomplete`. Neither is scored as a negative. Failure and exclusion logs retain run ID, case, condition, repetition, and bounded error class/status. The harness continues with subsequent authorized cases.

## Analysis plan

Report descriptive case-level and run-level summaries by condition. Because the corpus is small, purposively sampled, and mock repetitions are deterministic rather than independent, no null-hypothesis significance test or inferential confidence interval is planned. No causal or general population claim will be made. A later authorized real-model extension requires a separate amendment and analysis plan.

## Integrity, freezing, and amendments

Before the pilot, this protocol and the unfrozen corpus are version controlled. The pilot validates schema, mappings, runner, scoring, and artifact generation; pilot measurements are not final results. Any protocol/corpus change after the pilot must be recorded below with a reason and the pilot rerun. The corpus `frozen` flag is then set to true, SHA-256 hashes are recorded in the run manifest, and the final study uses a new study ID.

Scanner execution receives only case ID and closed manifest/adaptive/hybrid references. Ground-truth labels are never passed to an engine or provider. The scorer runs only after all raw outputs are collected.

## Threats to validity

- Construct validity: rule-to-objective mappings simplify complex vulnerabilities.
- Internal validity: fixtures are synthetic and mappings are purposive; shared implementation defects may affect conditions.
- External validity: results do not generalize to production agents, CTRL F2 systems, or real LLMs.
- Conclusion validity: the small corpus and deterministic repetitions support descriptive comparison only.
- Instrumentation: wall-clock durations include local interpreter overhead and are not infrastructure benchmarks.
- Provider limitation: mock-provider behavior does not establish prompt-injection susceptibility of a real model.
- Database limitation: the evaluation harness is file-based and local; Supabase deployment remains unverified.

## Amendment log

The `m7-pilot-001` validation executed 15 runs (five cases across C1/C2/C3 once) with no execution failures, mapping errors, or schema failures. No rule, correlation mapping, label, eligibility decision, metric definition, hypothesis, or analysis rule was changed after observing pilot outputs. The only corpus transition was setting its administrative `frozen` flag to true. Harness version 1.0.1 added explicit provider/model/prompt, fixture/scenario version, finding-reference, and corpus-manifest export fields that were already present inside raw component results; this export-only amendment changed no execution or scoring behavior. Pilot artifacts remain separate from final artifacts and are not included in final metrics.

The final corpus and protocol hashes are recorded by the final run manifest. Any subsequent content change invalidates those hashes and requires a new protocol version rather than overwriting this study.
