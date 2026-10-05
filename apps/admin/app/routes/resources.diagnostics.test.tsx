import { tamperAuditRecord } from "@sneakers-web/mock-gateway";
import { appRequest, sessionCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as audit from "@/routes/audit";
import * as frame from "@/routes/frame";
import { loader as diagnosticsLoader } from "@/routes/resources.diagnostics";
import { renderAdmin } from "@/test/stub";

withMockGateway();

beforeEach(() => {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/resources/diagnostics")) {
      return diagnosticsLoader({
        context: {},
        params: {},
        request: appRequest("/resources/diagnostics", {
          cookie: sessionCookie("mock-user-alice"),
        }),
      } as never);
    }
    return real(input, init);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Copy diagnostics in the admin console", () => {
  it("is on a danger alert, and copies the alert's message with the console's build", async () => {
    tamperAuditRecord(1197);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderAdmin([{ module: audit, path: "/audit" }], "/audit");
    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const text = writeText.mock.calls[0]![0];
    expect(text).toContain("App: admin");
    expect(text).toMatch(/Problem: .*Chain broken at #1197/);
  });

  it("is under About and diagnostics in the account menu", async () => {
    const user = userEvent.setup();
    renderAdmin([{ module: frame as never, path: "/" }], "/");
    await user.click(await screen.findByRole("button", { name: /^Account: / }));
    await user.click(await screen.findByRole("menuitem", { name: "About and diagnostics" }));
    const dialog = await screen.findByRole("dialog", { name: "About and diagnostics" });
    expect(
      await within(dialog).findByText("mock-gateway-1.0.0 (mock-gateway-commit)"),
    ).toBeInTheDocument();
  });
});
