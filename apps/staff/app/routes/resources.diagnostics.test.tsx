import { CheckoutsCheckinDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  server,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as checkouts from "@/routes/checkouts";
import * as frame from "@/routes/frame";
import { loader as diagnosticsLoader } from "@/routes/resources.diagnostics";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

let writeText: ReturnType<typeof vi.spyOn>;

/** user-event brings its own clipboard; spy on that one. */
const setup = () => {
  const user = userEvent.setup();
  writeText = vi.spyOn(navigator.clipboard, "writeText");
  return user;
};

// The browser's fetch of resources/diagnostics goes to the app's real loader, signed in as
// Alice; everything else (the loaders' gateway calls) still reaches the mock gateway.
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

const checkoutsPage = (): StubRoute => ({
  action: checkouts.action,
  Component: () => (
    <>
      <checkouts.default />
      <Toaster />
    </>
  ),
  loader: checkouts.loader,
  path: "/checkouts",
});

describe("Copy diagnostics", () => {
  it("is on an error toast, and names the refused operation, its reason and trace", async () => {
    server.use(
      gateway.mutation(CheckoutsCheckinDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: {
                code: "PERMISSION_DENIED",
                domain: "sneakers.workflow",
                reason: "CHECKIN_NOT_HOLDER",
                traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
              },
              message: "rpc error: code = PermissionDenied desc = only the holder",
            },
          ],
        } as never),
      ),
    );
    const user = setup();
    renderRoute("/checkouts", checkoutsPage());
    await user.click(await screen.findByRole("button", { name: "Check in Acme VPN" }));
    await screen.findByText("Only the person who checked it out can check it in.");
    // A plain click: sonner's swipe handling needs pointer capture, which jsdom lacks.
    fireEvent.click(await screen.findByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain("Problem: Only the person who checked it out can check it in.");
    expect(text).toContain(
      "operation CheckoutsCheckin, code PERMISSION_DENIED, reason CHECKIN_NOT_HOLDER, domain sneakers.workflow, trace 4bf92f3577b34da6a3ce929d0e0e4736",
    );
    expect(text).toContain("User: alice (mock-user-alice)");
    expect(text).toContain("App: staff");
    expect(text).toContain("vault: mock-vault-1.0.0");
    expect(text).toContain("rabbitmq: not configured");
    expect(text).not.toMatch(/mock_sneakers_sid|sid=/);
  });

  it("is under About and diagnostics in the account menu, with every version", async () => {
    const user = setup();
    renderRoute("/", { Component: frame.default, loader: frame.loader, path: "/" });
    await user.click(await screen.findByRole("button", { name: /^Account: / }));
    await user.click(await screen.findByRole("menuitem", { name: "About and diagnostics" }));
    const dialog = await screen.findByRole("dialog", { name: "About and diagnostics" });
    expect(
      await within(dialog).findByText(/^mock-vault-1\.0\.0 \(mock-vault-commit\)/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Sneakers 0.0.0-mock")).toBeInTheDocument();
    expect(within(dialog).getByText("mock-appliance-1.0.0")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toContain("Appliance: mock-appliance-1.0.0");
  });
});
