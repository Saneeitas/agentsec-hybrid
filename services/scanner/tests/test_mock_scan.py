import os

from fastapi.testclient import TestClient

from scanner.main import app


TOKEN = "scanner-test-token-with-at-least-32-characters"


def request(behavior: str = "success"):
    os.environ["SCANNER_SERVICE_TOKEN"] = TOKEN
    return TestClient(app).post(
        "/internal/v1/mock-scans",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "job_id": "00000000-0000-4000-8000-000000000001",
            "target_ref": "target-id",
            "mode": "hybrid",
            "behavior": behavior,
            "delay_ms": 0,
        },
    )


def test_mock_scan_requires_authentication() -> None:
    os.environ["SCANNER_SERVICE_TOKEN"] = TOKEN
    response = TestClient(app).post("/internal/v1/mock-scans", json={})
    assert response.status_code == 401


def test_mock_scan_returns_structured_result() -> None:
    response = request()
    assert response.status_code == 200
    assert response.json()["contractVersion"] == "v1"
    assert response.json()["outcome"] == "completed"


def test_mock_scan_supports_controlled_failure() -> None:
    assert request("failure").status_code == 503
