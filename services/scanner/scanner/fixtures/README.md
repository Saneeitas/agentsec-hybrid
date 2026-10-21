# M3 development fixture corpus

These manifests contain synthetic data and are packaged with the scanner. They are development fixtures, not a held-out research evaluation corpus.

| Fixture | Expected result |
|---|---|
| `lab://secure-agent` | No findings; secure values pass or are not applicable |
| `lab://vulnerable-agent` | DET-001 through DET-008 fail; eight findings; the synthetic inline value is never returned |
| `lab://incomplete-agent` | No findings; insufficient values yield unknown outcomes |
| `lab://malformed-agent` | Rejected as `invalid_manifest` |
| `lab://unsupported-agent` | Rejected as `unsupported_schema_version` |

Exact fixture identifiers are mapped in `deterministic/registry.py`; request values are never interpreted as paths.
