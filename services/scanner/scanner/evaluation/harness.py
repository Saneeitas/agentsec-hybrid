import hashlib
import json
import platform
import sys
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from .metrics import calculate_metrics
from .models import Condition, EvaluationCorpus
from ..adaptive.engine import ENGINE_VERSION as ADAPTIVE_VERSION
from ..adaptive.engine import execute_adaptive
from ..adaptive.models import AdaptiveBudgets, AdaptiveRequest
from ..adaptive.provider import MockProbeProvider
from ..correlation.engine import CORRELATION_VERSION, MAPPING_VERSION
from ..correlation.hybrid import execute_hybrid
from ..deterministic.engine import ENGINE_VERSION as DETERMINISTIC_VERSION
from ..deterministic.engine import build_result
from ..deterministic.registry import load_fixture

HARNESS_VERSION = "1.0.1"
DEFAULT_BUDGETS = AdaptiveBudgets(max_probes=4, max_provider_tokens=1024, max_wall_time_ms=5000)


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_value(value: object) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def load_corpus(path: Path) -> EvaluationCorpus:
    return EvaluationCorpus.model_validate_json(path.read_text())


def execution_inputs(corpus: EvaluationCorpus) -> list[dict[str, str]]:
    """Return scanner inputs only; ground-truth labels never cross this boundary."""
    return [
        {
            "caseId": case.case_id,
            "targetRef": case.target_ref,
            "manifestFixtureRef": case.manifest_fixture_ref,
            "adaptiveTargetRef": case.adaptive_target_ref,
            "hybridTargetRef": case.hybrid_target_ref,
        }
        for case in corpus.cases
    ]


def _run_id(study_id: str, case_id: str, condition: Condition, repetition: int) -> str:
    return str(uuid5(NAMESPACE_URL, f"{study_id}:{case_id}:{condition}:{repetition}"))


async def _execute(condition: Condition, item: dict[str, str], run_id: str) -> dict[str, object]:
    if condition == "C1":
        return build_result(run_id, item["targetRef"], load_fixture(item["manifestFixtureRef"]))
    if condition == "C2":
        request = AdaptiveRequest(job_id=run_id, target_ref=item["adaptiveTargetRef"], assessment_mode="simulator")
        return await execute_adaptive(request, MockProbeProvider(), DEFAULT_BUDGETS)
    return await execute_hybrid(run_id, item["hybridTargetRef"], "simulator", MockProbeProvider(), DEFAULT_BUDGETS)


def _detected_objectives(result: dict[str, object], condition: Condition, objectives: list[dict[str, object]]) -> tuple[set[str], dict[str, list[str]]]:
    by_rule = {rule: obj["objective_id"] for obj in objectives for rule in obj["deterministic_rule_ids"]}
    by_probe = {probe: obj["objective_id"] for obj in objectives for probe in obj["adaptive_probe_types"]}
    detected: set[str] = set()
    evidence: dict[str, list[str]] = defaultdict(list)

    def deterministic(source: dict[str, object] | None) -> None:
        for finding in (source or {}).get("findings", []):
            objective = by_rule.get(finding.get("ruleId"))
            if objective:
                detected.add(objective)
                evidence[objective].append(str(finding["findingId"]))

    def adaptive(source: dict[str, object] | None) -> None:
        probes = {record["probe"]["probe_id"]: record["probe"]["probe_type"] for record in (source or {}).get("probes", [])}
        for finding in (source or {}).get("findings", []):
            objective = by_probe.get(probes.get(finding.get("probeId"), ""))
            if objective:
                detected.add(objective)
                evidence[objective].append(str(finding["findingId"]))

    if condition == "C1":
        deterministic(result)
    elif condition == "C2":
        adaptive(result)
    else:
        deterministic(result.get("deterministicResult"))
        adaptive(result.get("adaptiveResult"))
        allowed_refs = {
            ref
            for finding in result.get("unifiedFindings", [])
            for ref in finding.get("deterministicFindingRefs", []) + finding.get("adaptiveFindingRefs", [])
        }
        for objective in list(evidence):
            evidence[objective] = sorted(set(evidence[objective]) & allowed_refs)
            if not evidence[objective]:
                detected.discard(objective)
    return detected, {key: sorted(set(value)) for key, value in evidence.items()}


def score_runs(corpus: EvaluationCorpus, runs: list[dict[str, object]]) -> list[dict[str, object]]:
    cases = {case.case_id: case for case in corpus.cases}
    objectives = [item.model_dump() for item in corpus.objectives]
    rows: list[dict[str, object]] = []
    for run in runs:
        case = cases[str(run["caseId"])]
        condition = str(run["condition"])
        if run["outcome"] != "completed":
            for label in case.labels:
                rows.append({"runId": run["runId"], "caseId": case.case_id, "condition": condition, "repetition": run["repetition"], "objectiveId": label.objective_id, "truth": label.state, "classification": "EXECUTION_ERROR", "evidence_references": []})
            continue
        result = run["rawResult"]
        detected, evidence = _detected_objectives(result, condition, objectives)
        for label in case.labels:
            if condition not in label.eligible_conditions:
                classification = "INELIGIBLE"
            elif label.state == "inconclusive":
                classification = "INCONCLUSIVE"
            elif label.state == "vulnerable":
                classification = "TP" if label.objective_id in detected else "FN"
            else:
                classification = "FP" if label.objective_id in detected else "TN"
            rows.append({"runId": run["runId"], "caseId": case.case_id, "condition": condition, "repetition": run["repetition"], "objectiveId": label.objective_id, "truth": label.state, "classification": classification, "evidence_references": evidence.get(label.objective_id, [])})
    return sorted(rows, key=lambda row: (row["condition"], row["caseId"], row["repetition"], row["objectiveId"]))


def summarize(runs: list[dict[str, object]], scored: list[dict[str, object]]) -> dict[str, object]:
    summary: dict[str, object] = {}
    for condition in ("C1", "C2", "C3"):
        condition_runs = [row for row in runs if row["condition"] == condition]
        condition_scores = [row for row in scored if row["condition"] == condition]
        first_repetition = [row for row in condition_scores if row["repetition"] == 1]
        signatures: dict[str, set[tuple[str, ...]]] = defaultdict(set)
        for run in condition_runs:
            if run["outcome"] == "completed":
                detected = tuple(sorted(row["objectiveId"] for row in condition_scores if row["runId"] == run["runId"] and row["classification"] in {"TP", "FP"}))
                signatures[str(run["caseId"])].add(detected)
        reproducible = sum(len(values) == 1 for values in signatures.values())
        completed = sum(row["outcome"] == "completed" for row in condition_runs)
        durations = [float(row["durationMs"]) for row in condition_runs]
        tokens = [int(row.get("providerTokens", 0)) for row in condition_runs]
        summary[condition] = {
            "caseLevelMetrics": calculate_metrics(first_repetition),
            "runLevelMetrics": calculate_metrics(condition_scores),
            "assessmentCompletionRate": round(completed / len(condition_runs), 6) if condition_runs else None,
            "meanDurationMs": round(sum(durations) / len(durations), 3) if durations else None,
            "totalProviderTokens": sum(tokens),
            "estimatedProviderCostUsd": 0.0,
            "reproducibleCaseFraction": round(reproducible / len(signatures), 6) if signatures else None,
            "reproducibilityNote": "Repeated mock-provider runs are deterministic checks, not independent stochastic observations.",
        }
    return summary


async def evaluate_study(corpus: EvaluationCorpus, study_id: str, repetitions: int = 3, *, pilot: bool = False) -> dict[str, object]:
    if not corpus.frozen and not pilot:
        raise ValueError("corpus_not_frozen")
    if not 1 <= repetitions <= 20:
        raise ValueError("invalid_repetition_count")
    inputs = execution_inputs(corpus)
    runs: list[dict[str, object]] = []
    order = ["C1", "C2", "C3"]
    for repetition in range(1, repetitions + 1):
        rotated = order[(repetition - 1) % 3:] + order[:(repetition - 1) % 3]
        for item in inputs:
            for condition in rotated:
                run_id = _run_id(study_id, item["caseId"], condition, repetition)
                started_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
                started = time.perf_counter()
                try:
                    result = await _execute(condition, item, run_id)
                    outcome = "completed" if result.get("outcome") == "completed" else "incomplete"
                    error = None if outcome == "completed" else str(result.get("overallStatus", "incomplete"))
                except Exception as exc:  # failure is an experimental outcome and must be retained
                    result, outcome, error = None, "execution_error", type(exc).__name__
                duration = (time.perf_counter() - started) * 1000
                adaptive = result if condition == "C2" else result.get("adaptiveResult") if result else None
                deterministic = result if condition == "C1" else result.get("deterministicResult") if result else None
                provider = (adaptive or {}).get("provider") or {}
                scenario_versions = sorted({
                    record.get("trace", {}).get("scenarioVersion", "unknown")
                    for record in (adaptive or {}).get("probes", [])
                })
                if condition == "C3":
                    finding_references = [item["correlationId"] for item in (result or {}).get("unifiedFindings", [])]
                else:
                    finding_references = [item["findingId"] for item in (result or {}).get("findings", [])]
                runs.append({
                    "runId": run_id, "studyId": study_id, "caseId": item["caseId"], "condition": condition,
                    "repetition": repetition, "executionOrder": rotated.index(condition) + 1,
                    "startedAt": started_at, "durationMs": round(duration, 3), "outcome": outcome,
                    "error": error, "providerTokens": (adaptive or {}).get("budgets", {}).get("usedProviderTokens", 0),
                    "provider": provider.get("provider"), "model": provider.get("model"),
                    "promptVersion": provider.get("prompt_version"),
                    "fixtureVersion": (deterministic or {}).get("fixtureVersion"),
                    "scenarioVersions": scenario_versions, "controlledSeed": None,
                    "findingReferences": sorted(finding_references),
                    "rawResult": result,
                })
    scored = score_runs(corpus, runs)
    return {
        "contractVersion": "evaluation-results/v1",
        "studyId": study_id,
        "phase": "pilot" if pilot else "final",
        "studyType": "controlled_simulation_with_deterministic_mock_provider",
        "harnessVersion": HARNESS_VERSION,
        "repetitions": repetitions,
        "engines": {"deterministic": DETERMINISTIC_VERSION, "adaptive": ADAPTIVE_VERSION, "correlation": CORRELATION_VERSION, "mapping": MAPPING_VERSION},
        "environment": {"python": sys.version.split()[0], "platform": platform.platform()},
        "runs": runs,
        "scored": scored,
        "metrics": summarize(runs, scored),
    }
