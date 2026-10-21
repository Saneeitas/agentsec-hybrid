from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr

KnownState = Literal["required", "none", "unknown"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Agent(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    capabilities: list[str] | None = Field(default=None, max_length=50)


class Tool(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    operations: list[str] | None = Field(default=None, max_length=50)
    authorization: KnownState = "unknown"
    approval: KnownState = "unknown"
    resource_scopes: list[str] | None = Field(default=None, max_length=50)


class Credential(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    source: Literal["environment", "secret_store", "inline", "unknown"]
    value: SecretStr | None = Field(default=None, max_length=256)


class Credentials(StrictModel):
    references: list[Credential] = Field(default_factory=list, max_length=50)
    logging_redaction: bool | None = None


class Network(StrictModel):
    exposure: Literal["private", "public", "unknown"] = "unknown"
    service_authentication: KnownState = "unknown"
    tls: KnownState = "unknown"
    outbound_allowlist: list[str] | None = Field(default=None, max_length=50)


class Controls(StrictModel):
    sandboxing: bool | None = None
    least_privilege: bool | None = None
    audit_logging: bool | None = None


class DeploymentManifest(StrictModel):
    schema_version: Literal["agent-deployment/v1"]
    fixture_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    agent: Agent
    tools: list[Tool] = Field(default_factory=list, max_length=50)
    credentials: Credentials
    network: Network
    controls: Controls
