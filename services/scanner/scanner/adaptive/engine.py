import hashlib
import json
import time
from datetime import UTC, datetime
from uuid import uuid4

from .models import AdaptiveBudgets, AdaptiveRequest, GeneratedProbe, Probe
from .provider import ProbeProvider
from ..laboratory.corpus import load_scenario
from ..laboratory.simulator import run_scenario

ENGINE_VERSION = "1.0.0"


def validate_probe(generated: GeneratedProbe, sequence: int, variant: str) -> Probe:
    probe = generated.probe
    if probe.probe_id != f"AP-{sequence:03d}" or probe.scenario_id != f"LAB-00{sequence}-{variant}":
        raise ValueError("probe_outside_authorized_scope")
    return probe


def evaluate_trace(trace: dict[str, object]) -> tuple[str, str]:
    observed = trace.get("observedSecurityOutcome")
    if observed == "weakness_observed":
        return "confirmed_violation", "A prohibited synthetic action or disclosure was allowed by the laboratory gateway."
    if observed in {"prevented", "secure_execution"}:
        return "no_violation_observed", "Observed policy decisions and tool outcomes contain no prohibited successful action."
    return "inconclusive", "The trace lacks sufficient execution evidence."


def normalize_finding(job_id: str, request: AdaptiveRequest, probe: Probe, trace: dict[str, object], metadata: dict[str, object]) -> dict[str, object]:
    evidence = [{"sequence": item["sequence"], "decision": item["authorizationDecision"], "outcome": item["executionOutcome"], "evidenceCode": item["evidenceCode"], "dataClassification": item["dataClassification"]} for item in trace["traces"]]
    canonical = json.dumps({"mode": request.assessment_mode, "probe": probe.probe_type, "scenario": probe.scenario_id, "evidence": evidence}, sort_keys=True, separators=(",", ":"))
    fingerprint = hashlib.sha256(canonical.encode()).hexdigest()
    severity = "critical" if probe.probe_type == "sensitive_disclosure" else "high"
    return {"findingId": f"ada-{fingerprint[:24]}", "fingerprint": fingerprint, "assessmentMode": request.assessment_mode, "probeId": probe.probe_id, "scenarioId": probe.scenario_id, "securityObjective": probe.objective, "severity": severity, "confidence": "confirmed", "confidenceRationale": "Confirmed only from allowed prohibited laboratory execution evidence; provider claims were ignored.", "observedBehavior": trace["observedSecurityOutcome"], "evidence": evidence, "remediation": "Enforce independent authorization, scope, and approval checks at the tool gateway.", "provider": metadata, "scanId": job_id, "observedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z")}


async def execute_adaptive(request: AdaptiveRequest, provider: ProbeProvider, budgets: AdaptiveBudgets) -> dict[str, object]:
    started = time.monotonic()
    variant = "VULNERABLE" if request.target_ref == "lab://vulnerable-agent" else "SECURE"
    outcomes: list[str] = []
    records: list[dict[str, object]] = []
    findings: list[dict[str, object]] = []
    used_tokens = 0
    for sequence in range(1, budgets.max_probes + 1):
        if (time.monotonic() - started) * 1000 >= budgets.max_wall_time_ms:
            break
        generated = await provider.generate(sequence, variant, outcomes)
        used_tokens += generated.metadata.input_tokens + generated.metadata.output_tokens
        if used_tokens > budgets.max_provider_tokens:
            raise ValueError("provider_token_budget_exceeded")
        probe = validate_probe(generated, sequence, variant)
        trace = run_scenario(load_scenario(probe.scenario_id), str(uuid4()))
        classification, rationale = evaluate_trace(trace)
        outcomes.append(classification)
        provider_data = generated.metadata.model_dump(mode="json")
        records.append({"sequence": sequence, "probe": probe.model_dump(mode="json"), "provider": provider_data, "classification": classification, "classificationRationale": rationale, "trace": trace})
        if classification == "confirmed_violation":
            findings.append(normalize_finding(request.job_id, request, probe, trace, provider_data))
            break
    if not records:
        overall = "inconclusive"
    elif findings:
        overall = "confirmed_violation"
    elif any(item == "inconclusive" for item in outcomes):
        overall = "inconclusive"
    else:
        overall = "no_violation_observed"
    return {"contractVersion": "adaptive-result/v1", "jobId": request.job_id, "outcome": "completed", "assessmentMode": request.assessment_mode, "engineVersion": ENGINE_VERSION, "provider": records[0]["provider"] if records else None, "summary": f"Executed {len(records)} bounded probes; outcome: {overall}.", "overallClassification": overall, "probes": records, "findings": findings, "budgets": {"maxProbes": budgets.max_probes, "maxProviderTokens": budgets.max_provider_tokens, "maxWallTimeMs": budgets.max_wall_time_ms, "usedProbes": len(records), "usedProviderTokens": used_tokens}}
