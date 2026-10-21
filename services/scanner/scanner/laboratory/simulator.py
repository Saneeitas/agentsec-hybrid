import json
import time
from datetime import UTC, datetime
from uuid import UUID

from .models import Action, Decision, Scenario, ToolPolicy

MAX_STEPS = 20
MAX_RUNTIME_MS = 1_000
MAX_TRACE_BYTES = 128 * 1024


def _policy(scenario: Scenario, action: Action) -> ToolPolicy | None:
    return next((item for item in scenario.policies if item.tool == action.tool), None)


def _decide(policy: ToolPolicy | None, action: Action) -> tuple[Decision, str]:
    if policy is None:
        return "deny", "tool_not_registered"
    operation_allowed = "*" in policy.allowed_operations or action.operation in policy.allowed_operations
    scope_allowed = "*" in policy.allowed_scopes or action.requested_scope in policy.allowed_scopes
    if policy.authorization_enforced and not operation_allowed:
        return "deny", "operation_denied"
    if policy.authorization_enforced and not scope_allowed:
        return "deny", "scope_denied"
    if policy.approval_required and policy.approval_enforced and not action.approved:
        return "require_approval", "approval_required"
    if not policy.authorization_enforced and not operation_allowed:
        return "allow", "unauthorized_invocation_allowed"
    if not policy.authorization_enforced:
        return "allow", "insecure_runtime_enforcement"
    if "*" in policy.allowed_operations and action.operation not in {"read", "search", "send", "update", "execute"}:
        return "allow", "overbroad_operation_allowed"
    if "*" in policy.allowed_scopes and action.requested_scope not in {"team-a"}:
        return "allow", "sensitive_access_allowed"
    if policy.approval_required and not policy.approval_enforced and not action.approved:
        return "allow", "unapproved_privileged_action_allowed"
    return "allow", "authorized_action_completed"


def run_scenario(scenario: Scenario, run_id: str) -> dict[str, object]:
    UUID(run_id)
    if len(scenario.actions) > MAX_STEPS:
        raise ValueError("step_limit_exceeded")
    started = time.monotonic()
    observed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    traces = []
    for sequence, action in enumerate(scenario.actions, 1):
        if (time.monotonic() - started) * 1000 > MAX_RUNTIME_MS:
            raise ValueError("runtime_limit_exceeded")
        policy = _policy(scenario, action)
        decision, reason = _decide(policy, action)
        resource = next((item for item in scenario.resources if item.id == action.resource_id), None)
        classification = resource.classification if resource else "public"
        traces.append({"sequence": sequence, "scenarioId": scenario.scenario_id, "runId": run_id, "agentId": scenario.agent_id, "toolId": action.tool, "requestedAction": {"operation": action.operation, "resourceId": action.resource_id, "scope": action.requested_scope}, "policyContext": {"authorizationEnforced": policy.authorization_enforced if policy else True, "approvalRequired": policy.approval_required if policy else False, "approved": action.approved}, "authorizationDecision": decision, "executionOutcome": "simulated_success" if decision == "allow" else "not_executed", "dataClassification": classification, "evidenceCode": reason, "value": "[REDACTED]" if resource and classification == "sensitive" else None, "timestamp": observed_at})
    weakness_codes = {"overbroad_operation_allowed", "insecure_runtime_enforcement", "unauthorized_invocation_allowed", "sensitive_access_allowed", "unapproved_privileged_action_allowed", "intentionally_weakened_control"}
    observed_outcome = "weakness_observed" if any(item["evidenceCode"] in weakness_codes for item in traces) else "secure_execution" if all(item["authorizationDecision"] == "allow" for item in traces) else "prevented"
    result = {"contractVersion": "lab-trace/v1", "scenarioId": scenario.scenario_id, "scenarioVersion": scenario.version, "runId": run_id, "agentId": scenario.agent_id, "outcome": "completed", "observedSecurityOutcome": observed_outcome, "resetRequired": False, "traces": traces, "groundTruth": scenario.ground_truth.model_dump(mode="json", by_alias=True)}
    if len(json.dumps(result, separators=(",", ":")).encode()) > MAX_TRACE_BYTES:
        raise ValueError("output_limit_exceeded")
    return result
