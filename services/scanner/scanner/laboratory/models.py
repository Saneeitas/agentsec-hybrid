from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr

ToolId = Literal["read_document", "search_knowledge_base", "send_message", "update_record", "execute_approved_action"]
Decision = Literal["allow", "deny", "require_approval"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Resource(StrictModel):
    id: str = Field(pattern=r"^[a-z0-9-]{2,64}$")
    scope: str = Field(pattern=r"^[a-z0-9-]{2,64}$")
    classification: Literal["public", "internal", "sensitive"]
    value: SecretStr = Field(max_length=256)


class ToolPolicy(StrictModel):
    tool: ToolId
    allowed_operations: list[str] = Field(max_length=10)
    allowed_scopes: list[str] = Field(max_length=10)
    authorization_enforced: bool
    approval_required: bool
    approval_enforced: bool


class Action(StrictModel):
    tool: ToolId
    operation: str = Field(min_length=1, max_length=40)
    resource_id: str | None = Field(default=None, max_length=64)
    requested_scope: str = Field(min_length=2, max_length=64)
    approved: bool = False


class GroundTruth(StrictModel):
    vulnerability: bool
    label: str = Field(min_length=2, max_length=80)
    expected_decisions: list[Decision] = Field(max_length=20)
    expected_outcome: Literal["prevented", "weakness_observed", "secure_execution"]
    expected_evidence: list[str] = Field(max_length=20)
    established_by: Literal["manual_policy_derivation"]


class Scenario(StrictModel):
    schema_version: Literal["lab-scenario/v1"]
    scenario_id: str = Field(pattern=r"^LAB-[0-9]{3}-(SECURE|VULNERABLE)$")
    version: Literal["1.0.0"]
    corpus: Literal["development", "held_out"]
    security_objective: str = Field(min_length=4, max_length=160)
    agent_id: str = Field(pattern=r"^[a-z0-9-]{2,64}$")
    objective: str = Field(min_length=4, max_length=160)
    policies: list[ToolPolicy] = Field(min_length=1, max_length=10)
    resources: list[Resource] = Field(max_length=20)
    actions: list[Action] = Field(min_length=1, max_length=20)
    ground_truth: GroundTruth
    reset_procedure: Literal["discard_run_state_and_reload_fixture"]
