import hashlib
import json
from datetime import UTC, datetime

CORRELATION_VERSION = "1.0.0"
MAPPING_VERSION = "det-adaptive-map/v1"
RULE_TO_PROBE = {
    "DET-001": "prompt_injection",
    "DET-002": "unauthorized_tool",
    "DET-003": "approval_bypass",
    "DET-004": "cross_scope_access",
    "DET-005": "sensitive_disclosure",
    "DET-006": "sensitive_disclosure",
    "DET-007": "role_manipulation",
    "DET-008": "multi_step_influence",
}


def validate_mapping(mapping: dict[str, str]) -> None:
    allowed_rules = {f"DET-{number:03d}" for number in range(1, 9)}
    allowed_probes = {"prompt_injection", "unauthorized_tool", "approval_bypass", "cross_scope_access", "sensitive_disclosure", "tool_output_injection", "role_manipulation", "multi_step_influence"}
    if not mapping or not set(mapping).issubset(allowed_rules) or not set(mapping.values()).issubset(allowed_probes):
        raise ValueError("invalid_correlation_mapping")


def _fingerprint(target_ref: str, outcome: str, deterministic_refs: list[str], adaptive_refs: list[str]) -> str:
    canonical = json.dumps({"version": CORRELATION_VERSION, "target": target_ref, "outcome": outcome, "deterministic": sorted(deterministic_refs), "adaptive": sorted(adaptive_refs)}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _record(target_ref: str, outcome: str, category: str, severity: str, det: list[dict[str, object]], adaptive: list[dict[str, object]], rationale: str, remediation: str, limitations: list[str]) -> dict[str, object]:
    det_refs = [str(item["findingId"]) for item in det]
    adaptive_refs = [str(item["findingId"]) for item in adaptive]
    fingerprint = _fingerprint(target_ref, outcome, det_refs, adaptive_refs)
    return {"correlationId": f"cor-{fingerprint[:24]}", "fingerprint": fingerprint, "outcome": outcome, "category": category, "severity": severity, "evidenceStrength": "corroborated" if outcome == "corroborated_weakness" else "single_method" if outcome in {"configuration_only_weakness", "behavior_only_weakness"} else "mitigating" if outcome == "contradictory_mitigating_evidence" else "insufficient", "sourceMethods": (["deterministic"] if det else []) + (["adaptive"] if adaptive else []), "deterministicFindingRefs": det_refs, "adaptiveFindingRefs": adaptive_refs, "adaptiveProbeRefs": sorted({str(item["probeId"]) for item in adaptive}), "affectedComponents": sorted({str(item.get("affectedResource", item.get("scenarioId", "target"))) for item in det + adaptive}), "rationale": rationale, "remediation": remediation, "limitations": limitations, "correlationRule": MAPPING_VERSION, "correlationVersion": CORRELATION_VERSION, "observedOutcomes": sorted({str(item.get("observedBehavior", "configuration_detected")) for item in det + adaptive})}


def correlate(target_ref: str, deterministic: dict[str, object] | None, adaptive: dict[str, object] | None, component_status: dict[str, str], mapping: dict[str, str] = RULE_TO_PROBE) -> dict[str, object]:
    validate_mapping(mapping)
    det_findings = list(deterministic.get("findings", [])) if deterministic else []
    adaptive_findings = list(adaptive.get("findings", [])) if adaptive else []
    probes = list(adaptive.get("probes", [])) if adaptive else []
    consumed: set[str] = set()
    records: list[dict[str, object]] = []
    for det in det_findings:
        rule = str(det["ruleId"])
        probe_type = mapping.get(rule)
        matching = [item for item in adaptive_findings if item.get("securityObjective") and any(record.get("probe", {}).get("probe_type") == probe_type and record.get("probe", {}).get("probe_id") == item.get("probeId") for record in probes)] if probe_type else []
        tested = [item for item in probes if item.get("probe", {}).get("probe_type") == probe_type] if probe_type else []
        consumed.update(str(item["findingId"]) for item in matching)
        limitations = ["A no-violation observation is limited to the executed synthetic probe and is not proof of security."]
        if component_status.get("adaptive") != "completed":
            outcome, rationale = "inconclusive", "Deterministic evidence exists, but the adaptive component did not complete."
        elif matching:
            outcome, rationale = "corroborated_weakness", "Explicit mapping links the configuration weakness to a confirmed prohibited laboratory outcome."
        elif any(item.get("classification") == "no_violation_observed" for item in tested):
            outcome, rationale = "contradictory_mitigating_evidence", "Configuration evidence exists, while the mapped executed probe was prevented or securely enforced."
        elif any(item.get("classification") == "inconclusive" for item in tested):
            outcome, rationale = "inconclusive", "Configuration evidence exists, but mapped behavioral evidence was inconclusive."
        elif probe_type:
            outcome, rationale = "configuration_only_weakness", "Configuration evidence exists; no mapped confirmed runtime violation was observed."
        else:
            outcome, rationale = "uncorrelated", "No reviewed correlation mapping exists for this deterministic finding."
        records.append(_record(target_ref, outcome, str(det["category"]), str(det["severity"]), [det], matching, rationale, str(det["remediation"]), limitations))
    reverse = set(mapping.values())
    for finding in adaptive_findings:
        if str(finding["findingId"]) in consumed:
            continue
        probe_type = next((record.get("probe", {}).get("probe_type") for record in probes if record.get("probe", {}).get("probe_id") == finding.get("probeId")), None)
        outcome = "behavior_only_weakness" if probe_type in reverse else "uncorrelated"
        rationale = "Confirmed runtime violation has a reviewed objective mapping but no matching deterministic finding." if outcome == "behavior_only_weakness" else "Confirmed runtime evidence has no reviewed deterministic correlation mapping."
        records.append(_record(target_ref, outcome, str(probe_type or "adaptive_behavior"), str(finding["severity"]), [], [finding], rationale, str(finding["remediation"]), ["Runtime evidence comes from the controlled laboratory; mock-provider results do not establish real-model susceptibility."]))
    unique = {item["fingerprint"]: item for item in records}
    ordered = sorted(unique.values(), key=lambda item: (str(item["outcome"]), str(item["category"]), str(item["fingerprint"])))
    counts = {name: sum(item["outcome"] == name for item in ordered) for name in ("corroborated_weakness", "configuration_only_weakness", "behavior_only_weakness", "contradictory_mitigating_evidence", "inconclusive", "uncorrelated")}
    return {"correlationVersion": CORRELATION_VERSION, "mappingVersion": MAPPING_VERSION, "unifiedFindings": ordered, "counts": {"totalUnique": len(ordered), "corroborated": counts["corroborated_weakness"], "configurationOnly": counts["configuration_only_weakness"], "behaviorOnly": counts["behavior_only_weakness"], "mitigating": counts["contradictory_mitigating_evidence"], "inconclusive": counts["inconclusive"], "uncorrelated": counts["uncorrelated"]}, "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z")}
