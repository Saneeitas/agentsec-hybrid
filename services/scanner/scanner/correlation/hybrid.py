from .engine import correlate
from ..adaptive.engine import execute_adaptive
from ..adaptive.models import AdaptiveBudgets, AdaptiveRequest
from ..adaptive.provider import ProbeProvider
from ..deterministic.engine import build_result
from ..deterministic.registry import load_fixture

TARGET_MAPPING = {
    "lab://secure-agent": {"manifest": "lab://secure-agent", "adaptive": "lab://secure-agent"},
    "lab://vulnerable-agent": {"manifest": "lab://vulnerable-agent", "adaptive": "lab://vulnerable-agent"},
    "lab://eval-secure-control": {"manifest": "lab://secure-agent", "adaptive": "lab://secure-agent"},
    "lab://eval-shared-weakness": {"manifest": "lab://vulnerable-agent", "adaptive": "lab://vulnerable-agent"},
    "lab://eval-config-mitigated": {"manifest": "lab://vulnerable-agent", "adaptive": "lab://secure-agent"},
    "lab://eval-behavior-only": {"manifest": "lab://secure-agent", "adaptive": "lab://vulnerable-agent"},
    "lab://eval-incomplete": {"manifest": "lab://incomplete-agent", "adaptive": "lab://secure-agent"},
}


async def execute_hybrid(job_id: str, target_ref: str, assessment_mode: str, provider: ProbeProvider, budgets: AdaptiveBudgets) -> dict[str, object]:
    mapping = TARGET_MAPPING.get(target_ref)
    if mapping is None:
        raise ValueError("unsupported_hybrid_target")
    statuses = {"deterministic": "pending", "adaptive": "pending", "correlation": "pending"}
    errors: dict[str, str | None] = {"deterministic": None, "adaptive": None, "correlation": None}
    deterministic = None
    adaptive = None
    try:
        deterministic = build_result(job_id, target_ref, load_fixture(mapping["manifest"]))
        statuses["deterministic"] = "completed"
    except Exception:
        statuses["deterministic"] = "failed"
        errors["deterministic"] = "deterministic_component_failed"
    try:
        adaptive = await execute_adaptive(AdaptiveRequest(job_id=job_id, target_ref=mapping["adaptive"], assessment_mode=assessment_mode), provider, budgets)
        statuses["adaptive"] = "completed"
    except Exception:
        statuses["adaptive"] = "failed"
        errors["adaptive"] = "adaptive_component_failed"
    try:
        correlation = correlate(target_ref, deterministic, adaptive, statuses)
        statuses["correlation"] = "completed"
    except Exception:
        correlation = {"correlationVersion": "1.0.0", "mappingVersion": "det-adaptive-map/v1", "unifiedFindings": [], "counts": {"totalUnique": 0, "corroborated": 0, "configurationOnly": 0, "behaviorOnly": 0, "mitigating": 0, "inconclusive": 0, "uncorrelated": 0}}
        statuses["correlation"] = "failed"
        errors["correlation"] = "correlation_failed"
    complete = all(value == "completed" for value in statuses.values())
    return {"contractVersion": "hybrid-report/v1", "jobId": job_id, "outcome": "completed" if complete else "partial", "overallStatus": "completed" if complete else "partial_failure", "summary": f"Hybrid assessment produced {correlation['counts']['totalUnique']} unique findings.", "targetMappingVersion": "hybrid-target-map/v1", "componentStatus": statuses, "componentErrors": errors, "deterministicResult": deterministic, "adaptiveResult": adaptive, **correlation}
