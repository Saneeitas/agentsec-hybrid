import csv
import json
from pathlib import Path

from .harness import sha256_file, sha256_value


def _json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def _csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: "" if row.get(key) is None else row.get(key) for key in fields})


def export_results(
    result: dict[str, object],
    output: Path,
    corpus_path: Path,
    protocol_path: Path,
) -> dict[str, str]:
    output.mkdir(parents=True, exist_ok=True)
    corpus_data = json.loads(corpus_path.read_text())
    runs = result["runs"]
    scored = result["scored"]
    metrics = result["metrics"]
    failures = [
        {key: run[key] for key in ("runId", "caseId", "condition", "repetition", "outcome", "error")}
        for run in runs
        if run["outcome"] != "completed"
    ]
    exclusions = [
        {key: row[key] for key in ("runId", "caseId", "condition", "repetition", "objectiveId", "classification")}
        for row in scored
        if row["classification"] in {"INELIGIBLE", "INCONCLUSIVE", "EXECUTION_ERROR"}
    ]
    raw = [{key: value for key, value in run.items() if key != "rawResult"} | {"rawResult": run["rawResult"]} for run in runs]
    _json(output / "raw-results.json", raw)
    _json(output / "scored-results.json", scored)
    _json(output / "metrics.json", metrics)
    _json(output / "failure-exclusion-log.json", {"failures": failures, "exclusions": exclusions})
    _json(output / "corpus-manifest.json", {
        "schemaVersion": corpus_data["schema_version"],
        "corpusId": corpus_data["corpus_id"],
        "version": corpus_data["version"],
        "frozen": corpus_data["frozen"],
        "caseIds": [item["case_id"] for item in corpus_data["cases"]],
        "objectiveIds": [item["objective_id"] for item in corpus_data["objectives"]],
        "sha256": sha256_file(corpus_path),
    })
    _csv(output / "scored-results.csv", scored, ["runId", "caseId", "condition", "repetition", "objectiveId", "truth", "classification", "evidence_references"])
    metric_rows = []
    for condition, summary in metrics.items():
        for level in ("caseLevelMetrics", "runLevelMetrics"):
            metric_rows.append({"condition": condition, "level": level, **summary[level]})
    _csv(output / "metrics.csv", metric_rows, ["condition", "level", "truePositives", "falsePositives", "trueNegatives", "falseNegatives", "precision", "recall", "falsePositiveRate", "f1Score", "evidenceCoverage", "eligibleUnits", "ineligibleUnits", "inconclusiveUnits"])
    manifest = {
        key: result[key]
        for key in ("contractVersion", "studyId", "phase", "studyType", "harnessVersion", "repetitions", "engines", "environment")
    } | {
        "corpusSha256": sha256_file(corpus_path),
        "protocolSha256": sha256_file(protocol_path),
        "rawResultsCanonicalSha256": sha256_value(raw),
        "scoredResultsCanonicalSha256": sha256_value(scored),
        "executionCount": len(runs),
    }
    _json(output / "run-manifest.json", manifest)
    summary_lines = [
        "# Comparative summary",
        "",
        f"Study `{result['studyId']}` is a controlled simulation using the deterministic mock provider.",
        "Metrics are descriptive and eligibility-adjusted; no real-model or causal claim is made.",
        "",
        "| Condition | TP | FP | TN | FN | Precision | Recall | F1 | Completion | Mean ms |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for condition in ("C1", "C2", "C3"):
        item = metrics[condition]
        scored_item = item["caseLevelMetrics"]
        display = lambda value: "undefined" if value is None else str(value)  # noqa: E731
        summary_lines.append(f"| {condition} | {scored_item['truePositives']} | {scored_item['falsePositives']} | {scored_item['trueNegatives']} | {scored_item['falseNegatives']} | {display(scored_item['precision'])} | {display(scored_item['recall'])} | {display(scored_item['f1Score'])} | {display(item['assessmentCompletionRate'])} | {display(item['meanDurationMs'])} |")
    summary_lines.extend(["", "Repeated mock runs are technical repeatability checks, not independent stochastic observations.", "Provider cost is recorded as USD 0 because no paid or real provider was invoked."])
    (output / "comparative-summary.md").write_text("\n".join(summary_lines) + "\n")
    (output / "threats-to-validity.md").write_text(
        "# Threats to validity\n\n"
        "The corpus is small, purposive, synthetic, and uses fixed fixtures. Objective mappings simplify "
        "real vulnerabilities, conditions share implementation components, and local timings are not deployment "
        "benchmarks. Mock-provider repetitions are deterministic and do not measure real-model variability. "
        "No inferential statistics, causal conclusion, CTRL F2 system claim, Supabase verification claim, or "
        "real-model effectiveness claim is supported.\n"
    )
    return {path.name: sha256_file(path) for path in sorted(output.iterdir()) if path.is_file()}
