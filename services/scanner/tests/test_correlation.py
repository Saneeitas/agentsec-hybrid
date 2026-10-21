import asyncio
import json
import os

import pytest
from fastapi.testclient import TestClient

from scanner.adaptive.models import AdaptiveBudgets
from scanner.adaptive.provider import MockProbeProvider, ProviderError, ProbeProvider
from scanner.correlation.engine import RULE_TO_PROBE, correlate, validate_mapping
from scanner.correlation.hybrid import execute_hybrid
from scanner.main import app

TOKEN = "scanner-test-token-with-at-least-32-characters"
HEADERS = {"authorization": f"Bearer {TOKEN}"}
JOB_ID = "00000000-0000-0000-0000-000000000006"


def setup_module() -> None:
    os.environ["SCANNER_SERVICE_TOKEN"] = TOKEN
    os.environ["ADAPTIVE_PROVIDER"] = "mock"


def _det(rule: str = "DET-002") -> dict[str, object]:
    return {"findings": [{"findingId": f"det-{rule}", "ruleId": rule, "category": "tool_authorization", "severity": "high", "affectedResource": "tool/shell", "remediation": "Require authorization"}]}


def _adaptive(classification: str = "no_violation_observed", finding: bool = False, probe_type: str = "unauthorized_tool") -> dict[str, object]:
    findings = [{"findingId": "ada-1", "probeId": "AP-002", "scenarioId": "LAB-002-VULNERABLE", "securityObjective": "Unauthorized tool", "severity": "high", "observedBehavior": "weakness_observed", "remediation": "Enforce gateway"}] if finding else []
    return {"probes": [{"probe": {"probe_id": "AP-002", "probe_type": probe_type}, "classification": classification}], "findings": findings}


def test_mapping_is_explicit_and_invalid_mappings_are_rejected() -> None:
    validate_mapping(RULE_TO_PROBE)
    with pytest.raises(ValueError, match="invalid_correlation_mapping"):
        validate_mapping({"DET-999": "made_up"})


def test_corroborated_and_configuration_only_findings() -> None:
    adaptive = _adaptive("confirmed_violation", True)
    report = correlate("lab://vulnerable-agent", _det(), adaptive, {"deterministic": "completed", "adaptive": "completed"})
    assert report["counts"]["corroborated"] == 1
    report = correlate("lab://vulnerable-agent", _det(), {"probes": [], "findings": []}, {"deterministic": "completed", "adaptive": "completed"})
    assert report["counts"]["configurationOnly"] == 1


def test_behavior_only_mitigating_inconclusive_and_uncorrelated() -> None:
    behavior = correlate("lab://vulnerable-agent", {"findings": []}, _adaptive("confirmed_violation", True), {"deterministic": "completed", "adaptive": "completed"})
    assert behavior["counts"]["behaviorOnly"] == 1
    mitigating = correlate("lab://vulnerable-agent", _det(), _adaptive(), {"deterministic": "completed", "adaptive": "completed"})
    assert mitigating["counts"]["mitigating"] == 1
    inconclusive = correlate("lab://vulnerable-agent", _det(), None, {"deterministic": "completed", "adaptive": "failed"})
    assert inconclusive["counts"]["inconclusive"] == 1
    uncorrelated = correlate("lab://vulnerable-agent", {"findings": []}, _adaptive("confirmed_violation", True, "unmapped_probe"), {"deterministic": "completed", "adaptive": "completed"})
    assert uncorrelated["counts"]["uncorrelated"] == 1


def test_duplicate_suppression_stable_fingerprints_and_ordering() -> None:
    first = correlate("lab://vulnerable-agent", _det(), _adaptive("confirmed_violation", True), {"deterministic": "completed", "adaptive": "completed"})
    second = correlate("lab://vulnerable-agent", _det(), _adaptive("confirmed_violation", True), {"deterministic": "completed", "adaptive": "completed"})
    assert [item["fingerprint"] for item in first["unifiedFindings"]] == [item["fingerprint"] for item in second["unifiedFindings"]]
    assert first["counts"]["totalUnique"] == 1


def test_complete_hybrid_report_preserves_sources_without_secrets() -> None:
    report = asyncio.run(execute_hybrid(JOB_ID, "lab://vulnerable-agent", "simulator", MockProbeProvider(), AdaptiveBudgets()))
    assert report["overallStatus"] == "completed"
    assert report["counts"]["corroborated"] == 1
    assert report["deterministicResult"] and report["adaptiveResult"]
    assert "SYNTHETIC-SECRET-NEVER-EXPORT" not in json.dumps(report)


class FailingProvider(ProbeProvider):
    async def generate(self, sequence: int, variant: str, prior_outcomes: list[str]):
        raise ProviderError("provider_timeout")


def test_partial_provider_failure_preserves_deterministic_evidence() -> None:
    report = asyncio.run(execute_hybrid(JOB_ID, "lab://vulnerable-agent", "simulator", FailingProvider(), AdaptiveBudgets()))
    assert report["overallStatus"] == "partial_failure"
    assert report["componentStatus"]["adaptive"] == "failed"
    assert report["deterministicResult"] is not None
    assert report["counts"]["inconclusive"] == 8


def test_authenticated_hybrid_endpoint_and_target_rejection() -> None:
    client = TestClient(app)
    payload = {"job_id": JOB_ID, "target_ref": "lab://secure-agent", "assessment_mode": "simulator"}
    assert client.post("/internal/v1/hybrid-scans", json=payload).status_code == 401
    assert client.post("/internal/v1/hybrid-scans", headers=HEADERS, json=payload).status_code == 200
    payload["target_ref"] = "lab://unknown"
    assert client.post("/internal/v1/hybrid-scans", headers=HEADERS, json=payload).status_code == 422
