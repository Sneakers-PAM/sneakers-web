import { CheckoutsCheckinDocument, CheckoutsMineDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as checkouts from "@/routes/checkouts";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const page = (): StubRoute => ({
  action: checkouts.action,
  Component: () => (
    <>
      <checkouts.default />
      <Toaster />
    </>
  ),
  ErrorBoundary: checkouts.ErrorBoundary,
  loader: checkouts.loader,
  path: "/checkouts",
});

const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

describe("U-08 checkouts", () => {
  it("lists what the user holds, soonest to expire first, with a countdown", async () => {
    const alice = mockState.world.leases.find((l) => l.id === "mock-lease-1")!;
    mockState.world.leases.find((l) => l.id === "mock-lease-2")!.returned = true;
    mockState.world.leases.push({
      ...alice,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      id: "mock-lease-ending",
      secretId: "mock-secret-build-ssh",
    });
    renderRoute("/checkouts", page());
    expect(await screen.findByRole("heading", { name: "Your checkouts" })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Acme VPN|Build host deploy key/ });
    expect(links.map((l) => l.textContent)).toEqual(["Build host deploy key", "Acme VPN"]);
    expect(links[1]).toHaveAttribute("href", "/secret/mock-secret-acme-vpn");
    const ending = screen.getByRole("row", { name: /Build host deploy key/ });
    expect(within(ending).getByRole("timer")).toBeInTheDocument();
    expect(within(ending).getByText("ending")).toBeInTheDocument();
  });

  it("checks a secret in, and shows the empty state once nothing is held", async () => {
    const user = userEvent.setup();
    renderRoute("/checkouts", page());
    const row = await screen.findByRole("row", { name: /Acme VPN/ });
    await user.click(within(row).getByRole("button", { name: "Check in Acme VPN" }));
    expect(await screen.findByText("Acme VPN is checked in. It rotates now.")).toBeInTheDocument();
    expect(await screen.findByText("No active checkouts")).toBeInTheDocument();
    expect(mockState.world.leases.find((l) => l.id === "mock-lease-1")?.returned).toBe(true);
  });

  it("shows the empty state for someone who holds nothing", async () => {
    renderRoute("/checkouts", page(), { user: "mock-user-carol" });
    expect(await screen.findByText("No active checkouts")).toBeInTheDocument();
    expect(screen.getByText("Check out a privileged secret from its page.")).toBeInTheDocument();
  });

  it("says why a check-in was refused", async () => {
    server.use(
      gateway.mutation(CheckoutsCheckinDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: { code: "PERMISSION_DENIED", reason: "CHECKIN_NOT_HOLDER" },
              message:
                "rpc error: code = PermissionDenied desc = only the lease holder can check this secret in",
            },
          ],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/checkouts", page());
    await user.click(await screen.findByRole("button", { name: "Check in Acme VPN" }));
    expect(
      await screen.findByText("Only the person who checked it out can check it in."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acme VPN" })).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      gateway.query(CheckoutsMineDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "workflow down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/checkouts", page());
    expect(await screen.findByText("Checkouts didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Acme VPN" })).toBeInTheDocument();
  });
});
