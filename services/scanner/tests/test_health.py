from fastapi.testclient import TestClient

from scanner.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"service": "scanner", "status": "ok", "version": "0.1.0"}

