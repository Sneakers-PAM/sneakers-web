import { AgentsPendingUsesDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as approvals from "@/routes/approvals";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const page = (): StubRoute => ({
  action: approvals.action,
  Component: () => (
    <>
      <approvals.default />
      <Toaster />
    </>
  ),
  ErrorBoundary: approvals.ErrorBoundary,
  loader: approvals.loader,
  path: "/approvals",
});

const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);
const nowUnix = () => Math.floor(Date.now() / 1000);
const CAROL = { user: "mock-user-carol" };
const secretUse = (id: string) => mockState.world.secretUses.find((u) => u.id === id)!;

const addReveal = () =>
  mockState.world.secretUses.push({
    ...secretUse("mock-use-1"),
    argv: [],
    fieldKey: "password",
    id: "mock-use-reveal",
    reveal: true,
    secretName: "Acme VPN",
  });

describe("U-14 agent approvals", () => {
  it("lists what an owner may decide, with who asked, the command and a countdown", async () => {
    addReveal();
    renderRoute("/approvals", page(), CAROL);
    expect(await screen.findByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /DB admin/ });
    expect(within(row).getByText("psql -h db1.example.org -U postgres_admin")).toBeInTheDocument();
    expect(within(row).getByText("Build agent on build1")).toBeInTheDocument();
    expect(within(row).getByText("Alice")).toBeInTheDocument();
    expect(within(row).getByRole("timer")).toBeInTheDocument();
    const reveal = screen.getByRole("row", { name: /Acme VPN/ });
    expect(within(reveal).getByText("Reveal the value to the agent")).toBeInTheDocument();
    expect(
      within(reveal).getByRole("button", { name: "Review reveal of Acme VPN" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 waiting/)).toBeInTheDocument();
  });

  it("approves with a second factor, refusing a wrong code first", async () => {
    const user = userEvent.setup();
    renderRoute("/approvals", page(), CAROL);
    await user.click(await screen.findByRole("button", { name: "Approve use of DB admin" }));
    const dialog = await screen.findByRole("dialog", { name: "Approve use of DB admin?" });
    expect(
      within(dialog).getByText("psql -h db1.example.org -U postgres_admin"),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("6-digit code"), "000000");
    await user.click(within(dialog).getByRole("button", { name: "Approve use" }));
    expect(
      await within(dialog).findByText("Second factor was not accepted. Nothing was approved."),
    ).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("pending");
    await user.clear(within(dialog).getByLabelText("6-digit code"));
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await user.click(within(dialog).getByRole("button", { name: "Approve use" }));
    expect(await screen.findByText("Approved. The value goes to psql once.")).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("approved");
    expect(await screen.findByText("Nothing waiting")).toBeInTheDocument();
  });

  it("warns before a reveal to the agent", async () => {
    addReveal();
    const user = userEvent.setup();
    renderRoute("/approvals", page(), CAROL);
    await user.click(await screen.findByRole("button", { name: "Review reveal of Acme VPN" }));
    const dialog = await screen.findByRole("dialog", { name: "Reveal Acme VPN to the agent?" });
    expect(within(dialog).getByText(/Alice will see this value/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reveal to agent" })).toBeInTheDocument();
  });

  it("denies without a factor", async () => {
    const user = userEvent.setup();
    renderRoute("/approvals", page(), CAROL);
    await user.click(await screen.findByRole("button", { name: "Deny use of DB admin" }));
    expect(await screen.findByText("Denied. The request was refused.")).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("denied");
  });

  it("shows the empty state when nothing is waiting, and drops expired requests", async () => {
    secretUse("mock-use-1").expiresAtUnix = nowUnix() - 1;
    renderRoute("/approvals", page(), CAROL);
    expect(await screen.findByText("Nothing waiting")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Requests for secrets you own or approve appear here and in the header badge.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      gateway.query(AgentsPendingUsesDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/approvals", page(), CAROL);
    expect(await screen.findByText("Approvals didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("row", { name: /DB admin/ })).toBeInTheDocument();
  });

  it("shows the user's own requests apart, waiting for someone else, with Withdraw", async () => {
    const user = userEvent.setup();
    renderRoute("/approvals", page());
    expect(await screen.findByText("Nothing waiting")).toBeInTheDocument();
    const mine = screen.getByRole("region", { name: "Your requests" });
    const row = within(mine).getByRole("row", { name: /DB admin/ });
    expect(within(row).getByText("Waiting for an owner or approver")).toBeInTheDocument();
    expect(within(mine).queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Withdraw request for DB admin" }));
    expect(
      await screen.findByText("Withdrawn. Nobody needs to decide it now."),
    ).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("denied");
  });

  it("links a request only its requester can confirm to its run page", async () => {
    mockState.world.secretUses.push({
      ...secretUse("mock-use-1"),
      confirm: true,
      id: "mock-use-own",
    });
    renderRoute("/approvals", page());
    const mine = await screen.findByRole("region", { name: "Your requests" });
    const links = within(mine).getAllByRole("link", { name: "Confirm once" });
    expect(links[0]).toHaveAttribute("href", "/approvals/run/run_mock_build1");
  });
});
