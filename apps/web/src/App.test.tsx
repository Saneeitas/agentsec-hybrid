import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps workflows locked until an operator token is entered", () => { render(<App />); expect(screen.getByText("Operator access")).toBeInTheDocument(); expect(screen.queryByText("Register laboratory target")).not.toBeInTheDocument(); });
it("loads authenticated empty states", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))); render(<App />); fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "x".repeat(32) } }); fireEvent.click(screen.getByText("Open dashboard")); expect(await screen.findByText("Register laboratory target")).toBeInTheDocument(); expect(await screen.findByText("No scan jobs yet.")).toBeInTheDocument(); });
it("displays deterministic findings and remediation", async () => {
  const target = { id: "10000000-0000-0000-0000-000000000000", name: "Vulnerable fixture", fixtureRef: "lab://vulnerable-agent", description: null, authorizationConfirmed: true, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" };
  const result = { contractVersion: "v1", jobId: "20000000-0000-0000-0000-000000000000", outcome: "completed", summary: "One weakness", scannerVersion: "test", engineVersion: "1.0.0", manifestSchemaVersion: "agent-deployment/v1", fixtureVersion: "1.0.0", counts: { evaluated: 1, passed: 0, failed: 1, notApplicable: 0, unknown: 0 }, evaluations: [], findings: [{ findingId: "det-1", fingerprint: "abc", ruleId: "DET-001", ruleVersion: "1.0.0", category: "tool_permissions", severity: "high", targetRef: "lab://vulnerable-agent", affectedResource: "tool/shell", rationale: "Wildcard access", evidence: { operations: ["*"] }, remediation: "Constrain operations", scanId: "20000000-0000-0000-0000-000000000000", observedAt: "2026-10-21T00:00:00Z" }] };
  const job = { id: result.jobId, targetId: target.id, mode: "deterministic", status: "completed", mockBehavior: "success", attempts: 1, maxAttempts: 3, errorCode: null, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:01Z", startedAt: "2026-10-21T00:00:00Z", completedAt: "2026-10-21T00:00:01Z", cancelRequestedAt: null, result };
  vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => Promise.resolve(new Response(JSON.stringify(String(input).endsWith("/targets") ? [target] : [job]), { status: 200 }))));
  render(<App />); fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "x".repeat(32) } }); fireEvent.click(screen.getByText("Open dashboard"));
  expect(await screen.findByText("DET-001 · tool/shell")).toBeInTheDocument();
  expect(screen.getByText("Remediation: Constrain operations")).toBeInTheDocument();
});
