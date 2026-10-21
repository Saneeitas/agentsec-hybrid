import json
import os

from fastapi.testclient import TestClient

from scanner.deterministic.engine import build_result, evaluate
from scanner.deterministic.registry import FixtureError, load_fixture
from scanner.main import app

TOKEN = "scanner-test-token-with-at-least-32-characters"
HEADERS = {"authorization": f"Bearer {TOKEN}"}


def setup_module() -> None:
    os.environ["SCANNER_SERVICE_TOKEN"] = TOKEN


def test_every_rule_has_secure_negative_and_vulnerable_positive() -> None:
    secure = {item.rule_id: item.outcome for item in evaluate(load_fixture("lab://secure-agent"))}
    vulnerable = {item.rule_id: item.outcome for item in evaluate(load_fixture("lab://vulnerable-agent"))}
    for number in range(1, 9):
        rule = f"DET-{number:03d}"
        assert rule in secure and secure[rule] in {"passed", "not_applicable"}
        assert vulnerable[rule] == "failed"


def test_results_are_reproducible_and_secrets_are_redacted() -> None:
    manifest = load_fixture("lab://vulnerable-agent")
    first = build_result("00000000-0000-0000-0000-000000000001", "lab://vulnerable-agent", manifest)
    second = build_result("00000000-0000-0000-0000-000000000001", "lab://vulnerable-agent", manifest)
    assert [item["fingerprint"] for item in first["findings"]] == [item["fingerprint"] for item in second["findings"]]
    assert "SYNTHETIC-DO-NOT-USE" not in json.dumps(first)


def test_incomplete_configuration_returns_unknown_not_findings() -> None:
    result = build_result("00000000-0000-0000-0000-000000000001", "lab://incomplete-agent", load_fixture("lab://incomplete-agent"))
    assert result["counts"]["unknown"] >= 1
    assert result["counts"]["failed"] == 0


def test_registry_rejects_unknown_traversal_malformed_and_versions() -> None:
    for fixture, code in [("lab://../secure-agent", "unknown_fixture"), ("lab://unknown", "unknown_fixture"), ("lab://malformed-agent", "invalid_manifest"), ("lab://unsupported-agent", "unsupported_schema_version")]:
        try:
            load_fixture(fixture)
            raise AssertionError("fixture unexpectedly loaded")
        except FixtureError as error:
            assert str(error) == code


def test_authenticated_endpoint_returns_structured_findings() -> None:
    response = TestClient(app).post("/internal/v1/deterministic-scans", headers=HEADERS, json={"job_id": "00000000-0000-0000-0000-000000000001", "fixture_ref": "lab://vulnerable-agent", "mode": "deterministic"})
    assert response.status_code == 200
    assert response.json()["counts"]["failed"] == 8


def test_endpoint_rejects_unsupported_modes() -> None:
    response = TestClient(app).post("/internal/v1/deterministic-scans", headers=HEADERS, json={"job_id": "00000000-0000-0000-0000-000000000001", "fixture_ref": "lab://secure-agent", "mode": "adaptive"})
    assert response.status_code == 422
