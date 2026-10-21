import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from .models import DeploymentManifest, Tool

Outcome = Literal["passed", "failed", "not_applicable", "unknown"]
Severity = Literal["low", "medium", "high", "critical"]
ENGINE_VERSION = "1.0.0"
RULE_VERSION = "1.0.0"
HIGH_RISK = {"admin", "delete", "execute", "shell", "write"}


@dataclass(frozen=True)
class Evaluation:
    rule_id: str
    rule_version: str
    category: str
    description: str
    outcome: Outcome
    severity: Severity
    affected_resource: str
    rationale: str
    evidence: dict[str, object]
    remediation: str


def _eval_tool(rule_id: str, category: str, description: str, severity: Severity,
               tool: Tool, outcome: Outcome, rationale: str, evidence: dict[str, object],
               remediation: str) -> Evaluation:
    return Evaluation(rule_id, RULE_VERSION, category, description, outcome, severity,
                      f"tool/{tool.id}", rationale, evidence, remediation)


def evaluate(manifest: DeploymentManifest) -> list[Evaluation]:
    results: list[Evaluation] = []
    if not manifest.tools:
        for rule_id, category, desc in [
            ("DET-001", "tool_permissions", "Wildcard tool operations"),
            ("DET-002", "tool_authorization", "Missing tool authorization"),
            ("DET-003", "tool_approval", "Missing approval for high-risk operations"),
            ("DET-004", "resource_scope", "Overbroad resource scope"),
        ]:
            results.append(Evaluation(rule_id, RULE_VERSION, category, desc, "not_applicable", "high", "agent/tools", "No tools are declared.", {}, "Declare and constrain tools when used."))
    for tool in manifest.tools:
        operations = tool.operations
        results.append(_eval_tool("DET-001", "tool_permissions", "Wildcard tool operations", "high", tool,
            "unknown" if operations is None else "failed" if "*" in operations else "passed",
            "Tool operations are not declared." if operations is None else "Wildcard grants every operation." if "*" in operations else "Operations are explicitly enumerated.",
            {} if operations is None else {"operations": operations}, "Replace wildcard access with an explicit minimum operation set."))
        results.append(_eval_tool("DET-002", "tool_authorization", "Missing tool authorization", "high", tool,
            "unknown" if tool.authorization == "unknown" else "failed" if tool.authorization == "none" else "passed",
            "Authorization policy is unknown." if tool.authorization == "unknown" else "Tool use has no authorization control." if tool.authorization == "none" else "Tool authorization is required.",
            {"authorization": tool.authorization}, "Require authorization before tool invocation."))
        risky = None if operations is None else sorted(set(operations) & HIGH_RISK)
        outcome: Outcome = "unknown" if risky is None or (risky and tool.approval == "unknown") else "not_applicable" if not risky else "failed" if tool.approval == "none" else "passed"
        results.append(_eval_tool("DET-003", "tool_approval", "Missing approval for high-risk operations", "high", tool, outcome,
            "Operation or approval information is insufficient." if outcome == "unknown" else "No high-risk operation is declared." if outcome == "not_applicable" else "High-risk operations lack approval." if outcome == "failed" else "High-risk operations require approval.",
            {} if risky is None else {"high_risk_operations": risky, "approval": tool.approval}, "Require explicit approval for write, delete, execute, shell, and admin operations."))
        scopes = tool.resource_scopes
        results.append(_eval_tool("DET-004", "resource_scope", "Overbroad resource scope", "high", tool,
            "unknown" if scopes is None else "failed" if any(scope in {"*", "**"} for scope in scopes) else "passed",
            "Resource scopes are not declared." if scopes is None else "A wildcard resource scope is present." if any(scope in {"*", "**"} for scope in scopes) else "Resource scopes are explicit.",
            {} if scopes is None else {"resource_scopes": scopes}, "Limit access to named laboratory resources."))
    inline = [item.name for item in manifest.credentials.references if item.source == "inline" and item.value is not None]
    unknown_creds = [item.name for item in manifest.credentials.references if item.source == "unknown"]
    cred_outcome: Outcome = "failed" if inline else "unknown" if unknown_creds else "passed"
    results.append(Evaluation("DET-005", RULE_VERSION, "secret_handling", "Inline credential material", cred_outcome, "critical", "deployment/credentials", "Inline credential values are configured." if inline else "Credential source is unknown." if unknown_creds else "No inline credential value is configured.", {"inline_credential_references": inline, "unknown_credential_references": unknown_creds}, "Use environment injection or a dedicated secret store; remove inline values."))
    refs = manifest.credentials.references
    redaction = manifest.credentials.logging_redaction
    redaction_outcome: Outcome = "not_applicable" if not refs else "unknown" if redaction is None else "failed" if not redaction else "passed"
    results.append(Evaluation("DET-006", RULE_VERSION, "secret_handling", "Credential log redaction disabled", redaction_outcome, "high", "deployment/logging", "No credentials are declared." if not refs else "Redaction configuration is unknown." if redaction is None else "Credential redaction is disabled." if not redaction else "Credential redaction is enabled.", {"credential_reference_count": len(refs), "logging_redaction": redaction}, "Enable redaction for credentials and sensitive payloads."))
    net = manifest.network
    auth_outcome: Outcome = "unknown" if net.exposure == "unknown" or (net.exposure == "public" and net.service_authentication == "unknown") else "not_applicable" if net.exposure == "private" else "failed" if net.service_authentication == "none" else "passed"
    results.append(Evaluation("DET-007", RULE_VERSION, "network_authentication", "Public service without authentication", auth_outcome, "critical", "deployment/network", "Network exposure or authentication is unknown." if auth_outcome == "unknown" else "Service is not publicly exposed." if auth_outcome == "not_applicable" else "Public service has no authentication." if auth_outcome == "failed" else "Public service requires authentication.", {"exposure": net.exposure, "service_authentication": net.service_authentication}, "Keep the service private or require authenticated access."))
    sandbox = manifest.controls.sandboxing
    results.append(Evaluation("DET-008", RULE_VERSION, "deployment_isolation", "Deployment sandboxing disabled", "unknown" if sandbox is None else "failed" if not sandbox else "passed", "high", "deployment/controls", "Sandboxing configuration is unknown." if sandbox is None else "Deployment isolation is disabled." if not sandbox else "Deployment isolation is enabled.", {"sandboxing": sandbox}, "Run the agent in a constrained sandbox with least privilege."))
    return results


def build_result(job_id: str, target_ref: str, manifest: DeploymentManifest) -> dict[str, object]:
    evaluations = evaluate(manifest)
    observed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    findings = []
    for item in evaluations:
        if item.outcome != "failed":
            continue
        canonical = json.dumps({"rule": item.rule_id, "version": item.rule_version, "target": target_ref, "resource": item.affected_resource, "evidence": item.evidence}, sort_keys=True, separators=(",", ":"))
        fingerprint = hashlib.sha256(canonical.encode()).hexdigest()
        findings.append({"findingId": f"det-{fingerprint[:24]}", "fingerprint": fingerprint, "ruleId": item.rule_id, "ruleVersion": item.rule_version, "category": item.category, "severity": item.severity, "targetRef": target_ref, "affectedResource": item.affected_resource, "rationale": item.rationale, "evidence": item.evidence, "remediation": item.remediation, "scanId": job_id, "observedAt": observed_at})
    counts = {name: sum(item.outcome == name for item in evaluations) for name in ("passed", "failed", "not_applicable", "unknown")}
    return {"contractVersion": "v1", "jobId": job_id, "outcome": "completed", "summary": f"Evaluated {len(evaluations)} rule applications; detected {len(findings)} configuration weaknesses.", "scannerVersion": "0.3.0", "engineVersion": ENGINE_VERSION, "manifestSchemaVersion": manifest.schema_version, "fixtureVersion": manifest.fixture_version, "evaluations": [{"ruleId": x.rule_id, "ruleVersion": x.rule_version, "category": x.category, "description": x.description, "outcome": x.outcome, "affectedResource": x.affected_resource, "rationale": x.rationale} for x in evaluations], "findings": findings, "counts": {"evaluated": len(evaluations), "passed": counts["passed"], "failed": counts["failed"], "notApplicable": counts["not_applicable"], "unknown": counts["unknown"]}}
