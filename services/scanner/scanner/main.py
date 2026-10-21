import asyncio
import hmac
import os
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


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

