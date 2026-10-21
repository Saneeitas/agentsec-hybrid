import json
from importlib.resources import files

from pydantic import ValidationError

from .models import DeploymentManifest

MAX_MANIFEST_BYTES = 64 * 1024
REGISTRY = {
    "lab://secure-agent": "secure-agent.json",
    "lab://vulnerable-agent": "vulnerable-agent.json",
    "lab://incomplete-agent": "incomplete-agent.json",
    "lab://malformed-agent": "malformed-agent.json",
    "lab://unsupported-agent": "unsupported-agent.json",
}


class FixtureError(ValueError):
    pass


def load_fixture(fixture_ref: str) -> DeploymentManifest:
    name = REGISTRY.get(fixture_ref)
    if name is None:
        raise FixtureError("unknown_fixture")
    raw = files("scanner.fixtures").joinpath(name).read_bytes()
    if len(raw) > MAX_MANIFEST_BYTES:
        raise FixtureError("manifest_too_large")
    try:
        return DeploymentManifest.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as error:
        if b'"schema_version"' in raw and b'"agent-deployment/v1"' not in raw:
            raise FixtureError("unsupported_schema_version") from error
        raise FixtureError("invalid_manifest") from error
