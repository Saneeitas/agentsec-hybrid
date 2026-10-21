import asyncio
import hmac
import os
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .deterministic.engine import build_result
from .deterministic.registry import FixtureError, load_fixture
from .adaptive.engine import execute_adaptive
from .adaptive.models import AdaptiveBudgets, AdaptiveRequest
from .adaptive.provider import ProviderError, configured_provider
from .laboratory.corpus import list_scenarios, load_scenario
from .laboratory.simulator import run_scenario
from .correlation.hybrid import execute_hybrid


class HealthResponse(BaseModel):
    service: Literal["scanner"]
    status: Literal["ok"]
    version: str


class MockScanRequest(BaseModel):
    job_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    target_ref: str
    mode: Literal["deterministic", "adaptive", "hybrid"]
    behavior: Literal["success", "failure", "timeout"] = "success"
    delay_ms: int = Field(default=10, ge=0, le=30_000)


class MockObservation(BaseModel):
    type: Literal["mock_observation"]
    message: str


class MockScanResponse(BaseModel):
    contractVersion: Literal["v1"]
    jobId: str
    outcome: Literal["completed"]
    summary: str
    scannerVersion: str
    observations: list[MockObservation]


class DeterministicScanRequest(BaseModel):
    job_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    fixture_ref: str = Field(pattern=r"^lab://[a-z0-9][a-z0-9-]{1,62}$", max_length=70)
    mode: Literal["deterministic"]


class LabRunRequest(BaseModel):
    scenario_id: str = Field(pattern=r"^LAB-[0-9]{3}-(SECURE|VULNERABLE)$")
    run_id: str = Field(pattern=r"^[0-9a-f-]{36}$")


class HybridScanRequest(BaseModel):
    job_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    target_ref: Literal["lab://secure-agent", "lab://vulnerable-agent"]
    assessment_mode: Literal["simulator", "model_mediated"]


class LabResetRequest(BaseModel):
    scenario_id: str = Field(pattern=r"^LAB-[0-9]{3}-(SECURE|VULNERABLE)$")


def require_service_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("SCANNER_SERVICE_TOKEN", "")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if len(expected) < 32 or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


app = FastAPI(
    title="Agentic Security Scanner",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(service="scanner", status="ok", version="0.1.0")


@app.post(
    "/internal/v1/mock-scans",
    response_model=MockScanResponse,
    dependencies=[Depends(require_service_token)],
)
async def execute_mock_scan(request: MockScanRequest) -> MockScanResponse:
    await asyncio.sleep(request.delay_ms / 1000)
    if request.behavior == "failure":
        raise HTTPException(status_code=503, detail="controlled_mock_failure")
    return MockScanResponse(
        contractVersion="v1",
        jobId=request.job_id,
        outcome="completed",
        summary=f"Safe mock {request.mode} scan completed; no vulnerability checks executed.",
        scannerVersion="0.2.0-mock",
        observations=[MockObservation(type="mock_observation", message="Synthetic execution only")],
    )


@app.post(
    "/internal/v1/deterministic-scans",
    dependencies=[Depends(require_service_token)],
)
async def execute_deterministic_scan(request: DeterministicScanRequest) -> dict[str, object]:
    try:
        manifest = load_fixture(request.fixture_ref)
    except FixtureError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return build_result(request.job_id, request.fixture_ref, manifest)


@app.get("/internal/v1/lab/scenarios", dependencies=[Depends(require_service_token)])
async def laboratory_scenarios() -> list[dict[str, object]]:
    return list_scenarios()


@app.post("/internal/v1/lab/runs", dependencies=[Depends(require_service_token)])
async def execute_laboratory_scenario(request: LabRunRequest) -> dict[str, object]:
    try:
        return run_scenario(load_scenario(request.scenario_id), request.run_id)
    except ValueError as error:
        code = str(error)
        status = 404 if code == "unknown_scenario" else 422
        raise HTTPException(status_code=status, detail=code) from error


@app.post("/internal/v1/lab/reset", dependencies=[Depends(require_service_token)])
async def reset_laboratory_scenario(request: LabResetRequest) -> dict[str, object]:
    try:
        scenario = load_scenario(request.scenario_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"contractVersion": "lab-reset/v1", "scenarioId": scenario.scenario_id, "status": "reset", "procedure": scenario.reset_procedure}


@app.post("/internal/v1/adaptive-scans", dependencies=[Depends(require_service_token)])
async def execute_adaptive_scan(request: AdaptiveRequest) -> dict[str, object]:
    try:
        provider = configured_provider()
        budgets = AdaptiveBudgets(
            max_probes=int(os.environ.get("ADAPTIVE_MAX_PROBES", "4")),
            max_provider_tokens=int(os.environ.get("ADAPTIVE_MAX_PROVIDER_TOKENS", "1024")),
            max_wall_time_ms=int(os.environ.get("ADAPTIVE_MAX_WALL_TIME_MS", "5000")),
        )
        return await execute_adaptive(request, provider, budgets)
    except ProviderError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/internal/v1/hybrid-scans", dependencies=[Depends(require_service_token)])
async def execute_hybrid_scan(request: HybridScanRequest) -> dict[str, object]:
    try:
        provider = configured_provider()
        budgets = AdaptiveBudgets(max_probes=int(os.environ.get("ADAPTIVE_MAX_PROBES", "4")), max_provider_tokens=int(os.environ.get("ADAPTIVE_MAX_PROVIDER_TOKENS", "1024")), max_wall_time_ms=int(os.environ.get("ADAPTIVE_MAX_WALL_TIME_MS", "5000")))
        return await execute_hybrid(request.job_id, request.target_ref, request.assessment_mode, provider, budgets)
    except ProviderError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

