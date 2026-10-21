import json
import os

import pytest
from fastapi.testclient import TestClient

from scanner.laboratory.corpus import DEVELOPMENT, HELD_OUT, list_scenarios, load_scenario
from scanner.laboratory.simulator import run_scenario
from scanner.laboratory import simulator
from scanner.main import app

TOKEN = "scanner-test-token-with-at-least-32-characters"
HEADERS = {"authorization": f"Bearer {TOKEN}"}
RUN_ID = "00000000-0000-0000-0000-000000000004"


def setup_module() -> None:
    os.environ["SCANNER_SERVICE_TOKEN"] = TOKEN


def test_all_objectives_have_secure_and_vulnerable_variants() -> None:
    assert len(DEVELOPMENT) == 16
    for number in range(1, 9):
        assert f"LAB-{number:03d}-SECURE" in DEVELOPMENT
        assert f"LAB-{number:03d}-VULNERABLE" in DEVELOPMENT


@pytest.mark.parametrize("scenario_id", sorted(DEVELOPMENT))
def test_execution_matches_independent_ground_truth(scenario_id: str) -> None:
    scenario = load_scenario(scenario_id)
    result = run_scenario(scenario, RUN_ID)
    assert [item["authorizationDecision"] for item in result["traces"]] == scenario.ground_truth.expected_decisions
    assert [item["evidenceCode"] for item in result["traces"]] == scenario.ground_truth.expected_evidence
    assert result["observedSecurityOutcome"] == scenario.ground_truth.expected_outcome


def test_sensitive_values_are_redacted_and_trace_is_serializable() -> None:
    result = run_scenario(load_scenario("LAB-004-VULNERABLE"), RUN_ID)
    encoded = json.dumps(result, sort_keys=True)
    assert "SYNTHETIC-SECRET-NEVER-EXPORT" not in encoded
    assert '"value": "[REDACTED]"' in encoded
    assert result["contractVersion"] == "lab-trace/v1"


def test_repeatable_execution_except_documented_run_metadata() -> None:
    first = run_scenario(load_scenario("LAB-005-SECURE"), RUN_ID)
    second = run_scenario(load_scenario("LAB-005-SECURE"), RUN_ID)
    for result in (first, second):
        for trace in result["traces"]:
            trace.pop("timestamp")
    assert first == second


def test_step_limit_is_enforced() -> None:
    scenario = load_scenario("LAB-001-SECURE")
    scenario.actions = scenario.actions * 21
    with pytest.raises(ValueError, match="step_limit_exceeded"):
        run_scenario(scenario, RUN_ID)


def test_runtime_limit_is_enforced(monkeypatch: pytest.MonkeyPatch) -> None:
    ticks = iter([0.0, 2.0])
    monkeypatch.setattr(simulator.time, "monotonic", lambda: next(ticks))
    with pytest.raises(ValueError, match="runtime_limit_exceeded"):
        run_scenario(load_scenario("LAB-001-SECURE"), RUN_ID)


def test_closed_registry_and_held_out_separation() -> None:
    with pytest.raises(ValueError, match="unknown_scenario"):
        load_scenario("LAB-999-SECURE")
    assert set(HELD_OUT).isdisjoint(DEVELOPMENT)
    listed = {item["scenarioId"] for item in list_scenarios()}
    assert listed == set(DEVELOPMENT)
    assert listed.isdisjoint(HELD_OUT)


def test_authenticated_list_run_and_reset_interfaces() -> None:
    client = TestClient(app)
    assert client.get("/internal/v1/lab/scenarios").status_code == 401
    listed = client.get("/internal/v1/lab/scenarios", headers=HEADERS)
    assert listed.status_code == 200 and len(listed.json()) == 16
    run = client.post("/internal/v1/lab/runs", headers=HEADERS, json={"scenario_id": "LAB-006-VULNERABLE", "run_id": RUN_ID})
    assert run.status_code == 200 and run.json()["outcome"] == "completed"
    reset = client.post("/internal/v1/lab/reset", headers=HEADERS, json={"scenario_id": "LAB-006-VULNERABLE"})
    assert reset.json()["status"] == "reset"


def test_unknown_and_malformed_requests_are_rejected() -> None:
    client = TestClient(app)
    unknown = client.post("/internal/v1/lab/runs", headers=HEADERS, json={"scenario_id": "LAB-999-SECURE", "run_id": RUN_ID})
    malformed = client.post("/internal/v1/lab/runs", headers=HEADERS, json={"scenario_id": "../escape", "run_id": "bad", "actions": []})
    assert unknown.status_code == 404
    assert malformed.status_code == 422
