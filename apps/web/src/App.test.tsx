import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps workflows locked until an operator token is entered", () => { render(<App />); expect(screen.getByText("Operator access")).toBeInTheDocument(); expect(screen.queryByText("Register laboratory target")).not.toBeInTheDocument(); });
it("loads authenticated empty states", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))); render(<App />); fireEvent.change(screen.getByLabelText("Operator token"), { target: { value: "x".repeat(32) } }); fireEvent.click(screen.getByText("Open dashboard")); expect(await screen.findByText("Register laboratory target")).toBeInTheDocument(); expect(await screen.findByText("No scan jobs yet.")).toBeInTheDocument(); });
