import { useEffect, useState } from "react";
import type { PlatformStatus } from "@asf/contracts";

type ViewState =
  | { state: "loading" }
  | { state: "ready"; status: PlatformStatus }
  | { state: "error" };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export function App() {
  const [view, setView] = useState<ViewState>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/v1/status`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Platform status is unavailable");
        return response.json() as Promise<PlatformStatus>;
      })
      .then((status) => setView({ state: "ready", status }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setView({ state: "error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <p className="eyebrow">CTRL F2 · Research prototype</p>
      <h1>Agentic Security Framework</h1>
      <p className="summary">A controlled environment for evidence-led security assessment of authorized autonomous AI agents.</p>
      <section aria-live="polite">
        <h2>Platform status</h2>
        {view.state === "loading" && <p>Checking services…</p>}
        {view.state === "error" && <p className="error">Services are unavailable.</p>}
        {view.state === "ready" && (
          <ul>
            <li><span>TypeScript API</span><strong>{view.status.api.status}</strong></li>
            <li><span>Python scanner</span><strong>{view.status.scanner.status}</strong></li>
          </ul>
        )}
      </section>
      <p className="notice">Only explicitly authorized sandbox targets may be assessed.</p>
    </main>
  );
}

