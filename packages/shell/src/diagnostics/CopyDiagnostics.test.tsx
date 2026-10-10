import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DiagnosticsData } from "#shell/diagnostics/report";

import { CopyDiagnostics, DiagnosticsCopierProvider } from "#shell/diagnostics/CopyDiagnostics";

const data: DiagnosticsData = {
  app: { commit: "f00dfeed", name: "staff", version: "0.4.0" },
  gateway: {
    actor: { id: "user-1", roles: ["user"], username: "morgan" },
    appliance: "v0.1.0",
    box: null,
    gateway: {
      commit: "abc",
      dependencies: null,
      name: "gateway",
      status: "OK",
      version: "v0.1.0",
    },
    generatedAt: "2026-10-05T12:00:00Z",
    productVersion: null,
    publicUrl: "https://pam.example.org",
    services: [
      { commit: "def", dependencies: null, name: "vault", status: "OK", version: "v0.1.0" },
    ],
    thirdParty: [],
    traceId: "1111",
  },
};

describe("CopyDiagnostics", () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data, { status: 200 })));
    document.cookie = "mock_sneakers_sid=SID-SECRET";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("copies the report for the problem, with the builds and the user", async () => {
    render(
      <CopyDiagnostics
        problem={{ message: "Someone has it.", reason: "CHECKOUT_LEASE_HELD", traceId: "t-9" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const text = writeText.mock.calls[0]![0] as string;
    expect(fetch).toHaveBeenCalledWith("/resources/diagnostics", expect.anything());
    expect(text).toContain("CHECKOUT_LEASE_HELD");
    expect(text).toContain("trace t-9");
    expect(text).toContain("App: staff 0.4.0 (f00dfeed)");
    expect(text).toContain("User: morgan (user-1)");
    expect(text).toContain("vault: v0.1.0");
    expect(text).not.toContain("SID-SECRET");
  });

  it("still copies the page and browser when the app server can't answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<CopyDiagnostics problem={{ message: "Can't reach the server" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toContain("Gateway: not reachable");
  });

  it("copies an app's own report when the app provides one", async () => {
    const copy = vi.fn(async () => "the appliance's report");
    render(
      <DiagnosticsCopierProvider value={copy}>
        <CopyDiagnostics problem={{ message: "Page crashed: TypeError" }} />
      </DiagnosticsCopierProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(copy).toHaveBeenCalledOnce());
    expect(copy).toHaveBeenCalledWith(
      expect.objectContaining({ problem: { message: "Page crashed: TypeError" } }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
