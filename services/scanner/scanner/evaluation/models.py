from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Condition = Literal["C1", "C2", "C3"]
TruthState = Literal["vulnerable", "secure", "inconclusive"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Objective(StrictModel):
    objective_id: str = Field(pattern=r"^OBJ-[0-9]{3}$")
    name: str = Field(min_length=4, max_length=120)
    resource: str = Field(min_length=2, max_length=120)
    deterministic_rule_ids: list[str] = Field(max_length=8)
    adaptive_probe_types: list[str] = Field(max_length=8)


class Label(StrictModel):
    objective_id: str
    state: TruthState
    eligible_conditions: list[Condition] = Field(min_length=1, max_length=3)
    expected_observable_behavior: str = Field(min_length=4, max_length=240)
    rationale: str = Field(min_length=10, max_length=500)
    established_by: Literal["manual_policy_and_manifest_derivation"]


class EvaluationCase(StrictModel):
    case_id: str = Field(pattern=r"^EVAL-[0-9]{3}$")
    version: Literal["1.0.0"]
    corpus: Literal["held_out"]
    target_ref: str = Field(pattern=r"^lab://eval-[a-z0-9-]+$")
    manifest_fixture_ref: str = Field(pattern=r"^lab://[a-z0-9-]+$")
    adaptive_target_ref: Literal["lab://secure-agent", "lab://vulnerable-agent"]
    hybrid_target_ref: str = Field(pattern=r"^lab://eval-[a-z0-9-]+$")
    inclusion_rationale: str = Field(min_length=10, max_length=300)
    labels: list[Label] = Field(min_length=8, max_length=8)


class EvaluationCorpus(StrictModel):
    schema_version: Literal["evaluation-corpus/v1"]
    corpus_id: Literal["asf-controlled-evaluation"]
    version: Literal["1.0.0"]
    frozen: bool
    label_method: Literal["manual_policy_and_manifest_derivation"]
    objectives: list[Objective] = Field(min_length=8, max_length=8)
    cases: list[EvaluationCase] = Field(min_length=4, max_length=32)

    @model_validator(mode="after")
    def validate_references(self) -> "EvaluationCorpus":
        objective_ids = [item.objective_id for item in self.objectives]
        if len(set(objective_ids)) != len(objective_ids):
            raise ValueError("duplicate_objective")
        case_ids = [item.case_id for item in self.cases]
        if len(set(case_ids)) != len(case_ids):
            raise ValueError("duplicate_case")
        for case in self.cases:
            labels = [item.objective_id for item in case.labels]
            if sorted(labels) != sorted(objective_ids) or len(set(labels)) != len(labels):
                raise ValueError("case_objective_mismatch")
            if case.target_ref != case.hybrid_target_ref:
                raise ValueError("hybrid_target_mismatch")
        return self
