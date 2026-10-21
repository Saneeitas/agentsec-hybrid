import asyncio
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from scanner.evaluation.export import export_results
from scanner.evaluation.harness import (
    evaluate_study,
    execution_inputs,
    load_corpus,
    score_runs,
    sha256_file,
)
from scanner.evaluation.metrics import calculate_metrics

ROOT = Path(__file__).parents[3]
CORPUS = ROOT / "research/datasets/evaluation-corpus-v1.json"
PROTOCOL = ROOT / "research/protocols/m7-evaluation-protocol-v1.md"


def test_corpus_schema_and_independent_labels() -> None:
    corpus = load_corpus(CORPUS)
    assert len(corpus.cases) == 5
    assert len(corpus.objectives) == 8
    assert all(label.established_by == "manual_policy_and_manifest_derivation" for case in corpus.cases for label in case.labels)


def test_corpus_rejects_duplicate_and_missing_objectives(tmp_path: Path) -> None:
    raw = json.loads(CORPUS.read_text())
    raw["cases"][0]["labels"].pop()
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(raw))
    with pytest.raises(ValidationError, match="labels"):
        load_corpus(path)


def test_ground_truth_is_not_in_execution_inputs() -> None:
    inputs = execution_inputs(load_corpus(CORPUS))
    serialized = json.dumps(inputs)
    assert "labels" not in serialized
    assert "ground" not in serialized.lower()
    assert "rationale" not in serialized.lower()


def test_metrics_and_undefined_denominators() -> None:
    metrics = calculate_metrics([
        {"classification": "TP", "evidence_references": ["one"]},
        {"classification": "FN", "evidence_references": []},
        {"classification": "INELIGIBLE", "evidence_references": []},
    ])
    assert metrics == {
        "truePositives": 1, "falsePositives": 0, "trueNegatives": 0,
        "falseNegatives": 1, "precision": 1.0, "recall": 0.5,
        "falsePositiveRate": None, "f1Score": 0.666667, "evidenceCoverage": 1.0,
        "eligibleUnits": 2, "ineligibleUnits": 1, "inconclusiveUnits": 0,
    }
    empty = calculate_metrics([])
    assert empty["precision"] is None
    assert empty["recall"] is None
    assert empty["falsePositiveRate"] is None
    assert empty["f1Score"] is None


def test_matching_suppresses_duplicate_finding_references() -> None:
    corpus = load_corpus(CORPUS)
    result = {
        "findings": [
            {"findingId": "det-a", "ruleId": "DET-001"},
            {"findingId": "det-a", "ruleId": "DET-001"},
        ]
    }
    runs = [{"runId": "run", "caseId": "EVAL-002", "condition": "C1", "repetition": 1, "outcome": "completed", "rawResult": result}]
    scored = score_runs(corpus, runs)
    objective = next(row for row in scored if row["objectiveId"] == "OBJ-001")
    assert objective["classification"] == "TP"
    assert objective["evidence_references"] == ["det-a"]


def test_failed_runs_are_not_scored_as_negatives() -> None:
    corpus = load_corpus(CORPUS)
    runs = [{"runId": "run", "caseId": "EVAL-002", "condition": "C1", "repetition": 1, "outcome": "execution_error", "rawResult": None}]
    scored = score_runs(corpus, runs)
    assert {row["classification"] for row in scored} == {"EXECUTION_ERROR"}
    assert calculate_metrics(scored)["eligibleUnits"] == 0


def test_final_requires_frozen_corpus() -> None:
    corpus = load_corpus(CORPUS).model_copy(update={"frozen": False})
    with pytest.raises(ValueError, match="corpus_not_frozen"):
        asyncio.run(evaluate_study(corpus, "not-frozen", 1))


def test_repetitions_reproducibility_hashes_and_stable_exports(tmp_path: Path) -> None:
    corpus = load_corpus(CORPUS).model_copy(update={"frozen": True})
    result = asyncio.run(evaluate_study(corpus, "test-study", 2))
    assert len(result["runs"]) == 30
    assert len({run["runId"] for run in result["runs"]}) == 30
    assert all(item["reproducibleCaseFraction"] == 1.0 for item in result["metrics"].values())
    first = tmp_path / "first"
    second = tmp_path / "second"
    hashes_one = export_results(result, first, CORPUS, PROTOCOL)
    hashes_two = export_results(result, second, CORPUS, PROTOCOL)
    assert hashes_one == hashes_two
    assert sha256_file(first / "scored-results.json") == sha256_file(second / "scored-results.json")
