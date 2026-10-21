# M7 research artifacts

This directory contains the controlled M7 comparative simulation study. The study does not evaluate a real LLM, production target, CTRL F2 system, or Supabase deployment.

- `protocols/m7-evaluation-protocol-v1.md` is the frozen prospective protocol and amendment record.
- `datasets/evaluation-corpus-v1.json` is the independently labeled frozen case/objective corpus.
- `evaluation/run_evaluation.py` invokes the existing scanner engines and exports results.
- `experiments/m7-pilot` preserves the one-repetition validation pilot.
- `experiments/m7-final` preserves the three-repetition final study.

Run the frozen study from the repository root:

```bash
.venv/bin/python research/evaluation/run_evaluation.py \
  --phase final \
  --study-id m7-final-001 \
  --repetitions 3 \
  --output research/experiments/m7-final
```

Reusing the same study ID produces stable run identifiers but new timestamps and local duration observations, so it must not overwrite the preserved final study during ordinary verification. Automated tests exercise the runner with temporary output directories.

The final case-level denominators differ by design: C1 has 31 eligible units, C2 has 6, and C3 has 32. Compare eligibility-adjusted metrics together with these denominators. The observed perfect values on this small purposive corpus reflect tight fixture/rule alignment and are not evidence of general superiority.
