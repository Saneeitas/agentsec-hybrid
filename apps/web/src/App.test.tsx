import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.restoreAllMocks());

it("shows API and scanner health returned by the backend", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    api: { service: "api", status: "ok", version: "0.1.0" },
    scanner: { service: "scanner", status: "ok", version: "0.1.0" }
  }), { status: 200 })));

  render(<App />);
  expect(await screen.findByText("TypeScript API")).toBeInTheDocument();
  expect(screen.getByText("Python scanner")).toBeInTheDocument();
});

