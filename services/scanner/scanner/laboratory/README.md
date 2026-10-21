# Agent security laboratory

The M4 laboratory consumes strict `lab-scenario/v1` records from a closed registry. Each record defines identity/objective, fixed tool policies, synthetic resources, a controlled action sequence, expected decisions/outcome/evidence, a vulnerability label, and the reset procedure.

## Mock tools

| Tool | Simulated operation | Side effects |
|---|---|---|
| `read_document` | Read a fixture resource after operation/scope authorization | None outside per-run memory |
| `search_knowledge_base` | Search synthetic fixture records | None |
| `send_message` | Record a synthetic message action | No delivery or network access |
| `update_record` | Update a per-run synthetic record | Discarded after the run |
| `execute_approved_action` | Record an approved privileged action | No OS or external execution |

All tool requests originate in reviewed scenarios. Callers can select a scenario but cannot submit actions or tool inputs. Authorization defaults to denial when a tool has no policy. High-risk actions can yield `require_approval` and are not executed.

## Ground truth and corpus separation

Sixteen development cases provide secure and vulnerable variants for the eight M4 objectives. Labels, expected decisions, observable outcomes, and evidence codes were derived manually from each policy/action pair and stored before execution; scanner findings are not consulted. Tests execute every case and compare traces with those declarations.

A separately keyed held-out registry exists but is excluded from ordinary listing and execution. It is a separation mechanism, not yet a statistically meaningful evaluation corpus, and M4 performs no comparative research experiment.

## Evidence and reset

`lab-trace/v1` JSON contains scenario/run/agent/tool identifiers, sequence, requested action, relevant policy flags, decision, simulated outcome, data classification, evidence code, and timestamp. Sensitive values are always `[REDACTED]`. Runs allow at most 20 steps, 1 second of simulator time, and 128 KiB serialized output.

State is created from the immutable scenario at run start and discarded at completion. Reset validates the allowlisted scenario and confirms `discard_run_state_and_reload_fixture`; there is no external state to clean up.

Docker restricts service exposure and capabilities but is not a complete sandbox. The primary safety boundary is that the simulator contains no network, shell, cloud, filesystem-tool, dynamic import, code-evaluation, or real credential capability.
