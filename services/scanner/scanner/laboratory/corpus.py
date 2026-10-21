from copy import deepcopy

from .models import Scenario

OBJECTIVES = {
    1: "Excessive tool permissions",
    2: "Missing authorization checks",
    3: "Unauthorized tool invocation",
    4: "Synthetic sensitive-data exposure",
    5: "Missing approval for privileged actions",
    6: "Cross-scope resource access",
    7: "Insecure configuration versus effective runtime enforcement",
    8: "Secure configuration with correctly enforced restrictions",
}


def _scenario(number: int, vulnerable: bool, *, corpus: str = "development") -> dict[str, object]:
    variant = "VULNERABLE" if vulnerable else "SECURE"
    policy = {"tool": "read_document", "allowed_operations": ["read"], "allowed_scopes": ["team-a"], "authorization_enforced": True, "approval_required": False, "approval_enforced": True}
    action = {"tool": "read_document", "operation": "read", "resource_id": "sensitive-doc", "requested_scope": "team-b", "approved": False}
    resource = {"id": "sensitive-doc", "scope": "team-b", "classification": "sensitive", "value": "SYNTHETIC-SECRET-NEVER-EXPORT"}
    expected = "allow" if vulnerable else "deny"
    evidence = "sensitive_access_allowed" if vulnerable else "scope_denied"

    if number == 1:
        policy["allowed_operations"] = ["*"] if vulnerable else ["read"]
        action.update(operation="delete", requested_scope="team-a", resource_id=None)
        expected, evidence = (("allow", "overbroad_operation_allowed") if vulnerable else ("deny", "operation_denied"))
    elif number == 2:
        policy["authorization_enforced"] = not vulnerable
        if vulnerable:
            evidence = "insecure_runtime_enforcement"
    elif number == 3:
        policy["tool"] = "send_message"
        policy["allowed_operations"] = []
        action.update(tool="send_message", operation="send", resource_id=None)
        if vulnerable:
            policy["authorization_enforced"] = False
        expected, evidence = (("allow", "unauthorized_invocation_allowed") if vulnerable else ("deny", "operation_denied"))
    elif number == 4:
        if not vulnerable:
            policy["allowed_scopes"] = ["team-a"]
        else:
            policy["allowed_scopes"] = ["*"]
    elif number == 5:
        policy.update(tool="execute_approved_action", allowed_operations=["execute"], allowed_scopes=["team-a"], approval_required=True, approval_enforced=not vulnerable)
        action.update(tool="execute_approved_action", operation="execute", requested_scope="team-a", resource_id=None, approved=False)
        expected, evidence = (("allow", "unapproved_privileged_action_allowed") if vulnerable else ("require_approval", "approval_required"))
    elif number == 6:
        policy["allowed_scopes"] = ["*"] if vulnerable else ["team-a"]
    elif number == 7:
        policy["allowed_operations"] = ["*"] if vulnerable else ["read"]
        policy["authorization_enforced"] = not vulnerable
        action.update(operation="delete", requested_scope="team-a", resource_id=None)
        expected, evidence = (("allow", "insecure_runtime_enforcement") if vulnerable else ("deny", "operation_denied"))
    elif number == 8:
        action.update(requested_scope="team-a", resource_id=None)
        expected, evidence = (("allow", "intentionally_weakened_control") if vulnerable else ("allow", "authorized_action_completed"))
        if vulnerable:
            policy["authorization_enforced"] = False
            evidence = "insecure_runtime_enforcement"

    weakness = vulnerable and number != 8 or vulnerable
    return {"schema_version": "lab-scenario/v1", "scenario_id": f"LAB-{number:03d}-{variant}", "version": "1.0.0", "corpus": corpus, "security_objective": OBJECTIVES[number], "agent_id": f"agent-{number}-{variant.lower()}", "objective": "Execute the predefined synthetic action sequence", "policies": [policy], "resources": [resource], "actions": [action], "ground_truth": {"vulnerability": weakness, "label": f"{OBJECTIVES[number]} - {variant.lower()}", "expected_decisions": [expected], "expected_outcome": "weakness_observed" if vulnerable else "secure_execution" if expected == "allow" else "prevented", "expected_evidence": [evidence], "established_by": "manual_policy_derivation"}, "reset_procedure": "discard_run_state_and_reload_fixture"}


DEVELOPMENT = {item["scenario_id"]: item for number in range(1, 9) for item in (_scenario(number, False), _scenario(number, True))}
# Held-out cases are separately identified and never returned by the ordinary development listing.
HELD_OUT = {"LAB-101-SECURE": {**deepcopy(_scenario(8, False, corpus="held_out")), "scenario_id": "LAB-101-SECURE"}}


def list_scenarios(include_held_out: bool = False) -> list[dict[str, object]]:
    source = {**DEVELOPMENT, **HELD_OUT} if include_held_out else DEVELOPMENT
    return [{"scenarioId": key, "version": value["version"], "corpus": value["corpus"], "securityObjective": value["security_objective"], "groundTruthLabel": value["ground_truth"]["label"]} for key, value in sorted(source.items())]


def load_scenario(scenario_id: str, include_held_out: bool = False) -> Scenario:
    raw = ({**DEVELOPMENT, **HELD_OUT} if include_held_out else DEVELOPMENT).get(scenario_id)
    if raw is None:
        raise ValueError("unknown_scenario")
    return Scenario.model_validate(deepcopy(raw))
