# Final security review

Review date: 2026-10-22. This is an internal implementation review, not a penetration test, external audit, compliance certification, or production authorization.

## Confirmed controls

| Area | Implemented control | Verification |
|---|---|---|
| Credentials | Required values are environment-injected; examples contain placeholders; frontend receives no database/scanner secret | Configuration tests, repository secret scan |
| Operator boundary | Target, scan and laboratory routes require a minimum-32-character bearer token with constant-time comparison | API authentication tests |
| Service boundary | Scanner execution routes require a distinct service bearer token; scanner is not host-published in Compose | Scanner endpoint tests and Compose inspection |
| Target safety | API permits `lab://` identifiers only; scanner resolves exact closed registry keys and never dereferences them as URLs | Rejection, traversal and unknown-fixture tests |
| Input validation | Zod/Pydantic strict schemas, UUID/identifier patterns, field bounds, 1 MiB API body limit | Unit/API/scanner tests |
| Execution bounds | Worker concurrency, timeout, attempts/backoff and leases; adaptive probe/token/wall time; lab step/time/output bounds | Lifecycle and scanner budget tests |
| Database ownership | Only Fastify receives `DATABASE_URL`; scanner has no PostgreSQL dependency | Compose/configuration and source inspection |
| Database transport | Externally hosted PostgreSQL defaults to certificate-validating TLS | Database client/configuration tests; hosted endpoint unverified |
| Isolation | Non-root containers, read-only roots, small tmpfs, all Linux capabilities dropped, no-new-privileges | Compose builds and health checks |
| Evidence safety | Synthetic resources, `[REDACTED]` sensitive values, no raw inline secret evidence, bounded results | Redaction tests and research-artifact scan |
| Job integrity | Atomic claims, lease ownership, transactionally persisted results, cancellation-before-completion | PostgreSQL integration tests |
| Provider safety | Mock default; real provider requires explicit server configuration; generated probes cannot supply arbitrary tools/paths/targets | Adaptive tests and source inspection |
| Research integrity | Frozen labels are excluded from execution inputs; matching/deduplication and hashes are tested | M7 evaluation tests and final manifests |

## Residual risks

| Risk | Severity for deployment | Current treatment | Required deployment action |
|---|---|---|---|
| Shared bearer token has no user identity/RBAC | High | Acceptable only for loopback single-researcher prototype | Add managed identity, roles, revocation and attributable audit events |
| No API rate limiter or lockout | High if network exposed | Loopback binding limits current exposure | Add gateway/application rate limits and abuse monitoring |
| Application logging disabled | Medium–high | PostgreSQL transition records provide narrow job audit | Add structured secret-safe logs, correlation IDs, metrics and alerts |
| Health check omits database readiness | Medium | Scan failures expose DB issues indirectly | Add separate readiness check before orchestrated deployment |
| Evidence has no retention/deletion controls | High where real data exists | Current evidence is synthetic | Define retention, deletion, encryption and access policy before real data |
| No backup/restore exercise | High | Disposable PostgreSQL only | Configure Supabase backups/PITR as appropriate and perform restore drill |
| Docker network may allow outbound traffic | Medium | Mock tools implement no network operations | Enforce egress policy for scanner; explicitly allow only real-provider endpoint if approved |
| Optional provider URL is operator configured | Medium | Probe data cannot set it; adapter disabled by default | Validate approved endpoint, TLS and data-processing terms; apply egress allowlist |
| Browser token is vulnerable to page compromise | Medium | Kept in memory, not storage | Deploy strict CSP, dependency controls and proper session authentication |
| No CSRF mechanism | Low in bearer-header local model | Token is not cookie-based | Reassess with future authentication design |
| No external security testing | Unknown | Internal tests only | Perform authorized threat-led review before external exposure |
| Python vulnerability scan/SBOM absent | Medium | Versions pinned; Ruff/tests pass | Add approved dependency scanning and SBOM/signature process |

## Threat-boundary conclusions

- The primary safety property is capability absence and closed registries, not Docker alone.
- `lab://` values are identifiers, never network locations. Supporting external URLs would require a new SSRF and authorization design.
- A successful deterministic finding is configuration evidence, not exploitation proof.
- A confirmed adaptive finding proves only a controlled simulator policy violation. Mock-mediated execution is not proof of real-model prompt-injection susceptibility.
- A hybrid corroboration is stronger combined evidence within the synthetic lab, not a probability or security guarantee.
- A no-violation observation applies only to the probes executed within their budgets.

## Sensitive evidence handling

Only synthetic data is approved. Application tables currently retain results until an operator/database administrator removes them; no retention automation exists. Research artifacts are versioned files and should be treated as immutable evidence. Before non-synthetic use, document lawful basis, classification, access roles, encryption, retention period, secure deletion, backup retention and incident handling.

## Security acceptance decision

The repository is suitable for an isolated, loopback-bound academic demonstration with synthetic fixtures. It is not approved for public exposure, multi-user operation, production targets, customer data or autonomous exploitation. The blockers in `docs/traceability.md` must be resolved and independently reviewed before deployment scope expands.
