from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ProbeType = Literal[
    "prompt_injection", "unauthorized_tool", "approval_bypass", "cross_scope_access",
    "sensitive_disclosure", "tool_output_injection", "role_manipulation", "multi_step_influence",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Probe(StrictModel):
    contract_version: Literal["adaptive-probe/v1"]
    probe_id: str = Field(pattern=r"^AP-[0-9]{3}$")
    probe_type: ProbeType
    scenario_id: str = Field(pattern=r"^LAB-00[1-8]-(SECURE|VULNERABLE)$")
    objective: str = Field(min_length=4, max_length=160)
    prompt: str = Field(min_length=4, max_length=1000)
    selection_rationale: str = Field(min_length=4, max_length=300)
    claimed_success: bool = False


class ProviderMetadata(StrictModel):
    provider: Literal["mock", "openai_compatible"]
    model: str
    prompt_version: Literal["adaptive-planner/v1"]
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cost_usd: float | None = Field(default=None, ge=0)


class GeneratedProbe(StrictModel):
    probe: Probe
    metadata: ProviderMetadata


class AdaptiveRequest(StrictModel):
    job_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    target_ref: Literal["lab://secure-agent", "lab://vulnerable-agent"]
    assessment_mode: Literal["simulator", "model_mediated"]


class AdaptiveBudgets(StrictModel):
    max_probes: int = Field(default=4, ge=1, le=8)
    max_provider_tokens: int = Field(default=1024, ge=64, le=4096)
    max_wall_time_ms: int = Field(default=5000, ge=100, le=30_000)
