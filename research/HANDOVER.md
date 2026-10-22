# Academic research handover

## Problem and motivation

Autonomous AI agents combine model-directed behavior with tools, credentials, data scopes and deployment controls. Configuration review can identify explicit weaknesses but cannot show whether runtime enforcement prevents a tested action. Behavioral testing can observe policy outcomes but may miss untested configuration weaknesses and, when model-assisted, can be variable. This project implements and evaluates a framework that keeps those evidence types distinct and then correlates them through explicit rules.

The system is an assessment prototype, not a security guarantee, intrusion-prevention product or production scanner. CTRL F2 is a proposed case-study context only; no CTRL F2 system, customer environment or production data was assessed.

## Research objectives and questions

The engineering objectives were to build reproducible deterministic checks, a safe behavioral laboratory, bounded adaptive probe selection, auditable hybrid correlation, and a ground-truth-isolated evaluation harness.

The primary question asks whether a hybrid method improves detection coverage and assessment quality relative to deterministic-only and adaptive-only conditions, while considering false positives, runtime and reproducibility. M7 specified non-directional hypotheses and did not assume hybrid superiority.

## Framework design

The React dashboard manages synthetic targets and jobs through a Fastify API. Fastify exclusively owns PostgreSQL persistence and asynchronous job leasing. A stateless FastAPI scanner resolves closed fixtures, performs assessments and returns versioned JSON. The Python service never receives database credentials. Docker Compose starts only the three application services; PostgreSQL remains an external managed dependency or an explicit disposable integration-test resource.

## Deterministic methodology

The M3 engine validates `agent-deployment/v1` data and evaluates DET-001–DET-008 as explicit predicates. It covers wildcard operations, absent tool authorization, missing approval, wildcard resource scopes, inline credentials, disabled redaction, unauthenticated public exposure and disabled sandboxing. Missing information produces `unknown` or `not_applicable`; only evidence-backed failure creates a finding. Fingerprints are stable and evidence excludes raw secrets.

## Laboratory methodology

The M4 simulator executes predefined policy/action sequences for five synthetic tools. Tools have no external effects, shell, cloud or arbitrary filesystem access. The laboratory records policy decisions and simulated outcomes in redacted `lab-trace/v1` evidence. Ground truth was manually derived from manifest/policy/action data, not copied from scanner findings.

## Adaptive methodology

M5 separates provider generation, probe validation, lab execution, evidence evaluation and normalization. The deterministic mock provider is the verified default. A confirmed violation requires observed successful prohibited behavior in the simulator; provider claims are ignored. The optional OpenAI-compatible adapter is disabled by default and unverified. Consequently, results characterize controlled simulator behavior, not real-model prompt-injection susceptibility.

## Hybrid methodology

M6 executes both methods and correlates evidence with a versioned DET-rule/probe mapping. Outcomes distinguish corroborated, configuration-only, behavior-only, mitigating, inconclusive and uncorrelated evidence. Source findings remain intact. Severity is not increased simply because methods agree, and no numeric confidence probability is invented.

## Experimental design and ground truth

Protocol `ASF-M7-PROTOCOL-001` was authored before pilot/final execution. The frozen corpus contains five purposive cases across eight objectives: secure control, shared/multiple weaknesses, vulnerable configuration with effective runtime enforcement, behavior-only weakness and incomplete evidence. Each case defines eligibility by condition. Engines receive only closed mapping references; labels are used by the scorer after raw execution.

The unit of analysis is one case/objective instance. Exact rule IDs and probe types map findings to labels. Duplicates count once. Ineligible, inconclusive and failed units do not become false negatives or true negatives. Three repetitions rotate C1/C2/C3 order; deterministic mock repeats test technical repeatability rather than stochastic variation.

## Actual M7 findings

The final `m7-final-001` study completed 45 of 45 scheduled runs without execution failure.

| Condition | Eligible units | TP | FP | TN | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| C1 deterministic | 31 | 16 | 0 | 15 | 0 | 1.0 | 1.0 | 1.0 |
| C2 adaptive mock | 6 | 2 | 0 | 4 | 0 | 1.0 | 1.0 | 1.0 |
| C3 hybrid | 32 | 17 | 0 | 15 | 0 | 1.0 | 1.0 | 1.0 |

All conditions had 1.0 completion, evidence coverage and detected-set reproducibility on eligible units. C2 and C3 each recorded 1,512 mock-provider tokens across repeated runs at estimated provider cost USD 0. Final recorded mean local durations were 0.406 ms (C1), 0.465 ms (C2) and 0.852 ms (C3).

## Interpretation

The experiment demonstrates that the implemented engines, mappings and scorer behave consistently on their designed synthetic cases. C3 covered one more eligible case/objective unit than C1 by detecting the behavior-only case, while C2 was eligible for far fewer units because it does not observe most configuration evidence and stops after a confirmed violation. Equal rates therefore do not mean equal coverage.

The data do not establish that hybrid scanning is statistically or generally superior. Perfect rates are expected to be sensitive to the tight alignment between fixtures, explicit rules and labels. No inferential significance test or confidence interval was calculated because the corpus is small and purposive and repetitions are not independent observations.

## Limitations and threats to validity

- Synthetic fixtures and policies may not represent real agent platforms.
- The corpus contains five cases and is unsuitable for population inference.
- Conditions share implementation components, creating correlated failure risk.
- The deterministic mock provider has no real-model variability or model reasoning.
- Eligibility differs substantially across conditions.
- Local timing reflects interpreter overhead, not deployment performance.
- Ground-truth/objective mappings simplify real vulnerabilities.
- Supabase deployment, real-provider behavior and external targets remain unverified.
- No penetration test or independent external audit was conducted.

## Reproducibility and evidence

The frozen corpus SHA-256 is `fd914d995c090140d88dcf4e8b5119f55402eda216953526c8309901096f177d` and protocol SHA-256 is `a1344722eb8e08ba56e5ac8b58145527982d2f5a6fce6449c9867ca7bc01bdf8`. The final directory retains raw/scored JSON, CSV summaries, failure/exclusion log, run/corpus manifests and threats-to-validity report. `docs/reproducibility.md` explains how to verify rather than overwrite them.

## Future research opportunities

1. Pre-register a larger corpus with independently reviewed cases and agent-framework diversity.
2. Run an explicitly authorized real-model extension with repeated stochastic trials, recorded model settings and appropriate paired analysis.
3. Validate inter-rater agreement for ground-truth labels and correlation mappings.
4. Evaluate robustness to unseen manifestations without tuning against held-out outcomes.
5. Measure operational cost on representative hardware and hosted deployment.
6. Study secure evidence retention, privacy and governance for non-synthetic environments.
7. Compare alternative correlation strategies prospectively without using final-test labels for tuning.

No future work is implemented or implied as validated by this handover.
