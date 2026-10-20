from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: Literal["scanner"]
    status: Literal["ok"]
    version: str


app = FastAPI(
    title="Agentic Security Scanner",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(service="scanner", status="ok", version="0.1.0")

