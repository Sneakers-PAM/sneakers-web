import { RequestsListDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as requests from "@/routes/requests";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const page = (): StubRoute => ({
  action: requests.action,
  Component: () => (
    <>
      <requests.default />
      <Toaster />
    </>
  ),
  ErrorBoundary: requests.ErrorBoundary,
  loader: requests.loader,
  path: "/requests",
});

const failList = () =>
  server.use(
    graphql.link(`${MOCK_GATEWAY_URL}/graphql`).query(RequestsListDocument, async () => {
      await delay(20);
      return HttpResponse.json({
        errors: [{ extensions: { code: "UNAVAILABLE" }, message: "workflow down" }],
      } as never);
    }),
  );

const region = (name: string) => screen.getByRole("region", { name });
const findRegion = (name: string) => screen.findByRole("region", { name });
const leaseHours = (userId: string) => {
  const l = mockState.world.leases.find((x) => x.userId === userId && !x.returned);
  return l ? (Date.parse(l.expiresAt) - Date.parse(l.issuedAt)) / 3_600_000 : null;
};

const review = async (resource: RegExp) => {
  const user = userEvent.setup();
  const awaiting = await findRegion("Awaiting your approval");
  const row = within(awaiting).getByRole("row", { name: resource });
  await user.click(within(row).getByRole("button", { name: /^Review/ }));
  return { dialog: await screen.findByRole("dialog"), user };
};

describe("U-09 requests, on a desktop", () => {
  onDesktop();

  it("shows what waits on an approver, their open requests and the history", async () => {
    renderRoute("/requests", page());
    const awaiting = await findRegion("Awaiting your approval");
    expect(screen.getByRole("heading", { name: "Access requests" })).toBeInTheDocument();
    expect(within(awaiting).getByRole("row", { name: /Acme VPN.*Bob/ })).toBeInTheDocument();
    expect(
      within(awaiting).getByRole("row", { name: /DB admin.*quarterly report.*Dave/ }),
    ).toBeInTheDocument();
    expect(within(region("Your open requests")).getByText("No open requests.")).toBeInTheDocument();
    const history = region("History");
    expect(within(history).getByRole("row", { name: /Payroll portal/ })).toBeInTheDocument();
    expect(
      within(history).getByRole("row", { name: /Finance \/ Archive → Platform/ }),
    ).toBeInTheDocument();
  });

  it("approves from the review dialog for the hours picked, then lists it in History", async () => {
    renderRoute("/requests", page());
    const { dialog, user } = await review(/DB admin/);
    expect(
      within(dialog).getByText("Read-only access for the quarterly report."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Which change ticket is this for?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "More hours" }));
    await user.click(within(dialog).getByRole("button", { name: "Approve for 9h" }));
    expect(await screen.findByText("Approved for 9 h. Dave was notified.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(within(region("History")).getByRole("row", { name: /DB admin/ })).toBeInTheDocument(),
    );
    expect(leaseHours("mock-user-dave")).toBe(9);
  });

  it("denies, and posts to the thread with Enter", async () => {
    renderRoute("/requests", page());
    const { dialog, user } = await review(/DB admin/);
    await user.type(within(dialog).getByLabelText("Message"), "Which report?{Enter}");
    expect(await within(dialog).findByText("Which report?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Deny" }));
    expect(await screen.findByText("Denied. Dave was notified.")).toBeInTheDocument();
    expect(leaseHours("mock-user-dave")).toBeNull();
  });

  it("says why the gateway refused, in the dialog", async () => {
    renderRoute("/requests", page());
    const { dialog, user } = await review(/Acme VPN/);
    await user.click(within(dialog).getByRole("button", { name: "Approve for 8h" }));
    expect(
      await within(dialog).findByText(
        "Someone has this secret checked out. Try again after it's checked in.",
      ),
    ).toBeInTheDocument();
    expect(mockState.world.requests.find((r) => r.id === "mock-req-1")?.status).toBe("pending");
  });

  it("shows a move request's warning and approves the move", async () => {
    const denied = mockState.world.requests.find((r) => r.id === "mock-req-4")!;
    mockState.world.requests.push({
      ...denied,
      id: "mock-req-move",
      resolvedAt: undefined,
      resolvedByUserId: undefined,
      resolvedByUserName: undefined,
      status: "pending",
    });
    renderRoute("/requests", page(), { user: "mock-user-carol" });
    const { dialog, user } = await review(/Finance \/ Archive → Platform/);
    expect(within(dialog).getByText("Move request · needs a site admin")).toBeInTheDocument();
    expect(within(dialog).getByText(/loses access/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "More hours" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Approve move" }));
    expect(await screen.findByText("Moved. Bob was notified.")).toBeInTheDocument();
    expect(mockState.world.folders.find((f) => f.id === "mock-folder-archive")?.parentId).toBe(
      "mock-folder-platform",
    );
  });

  it("shows a requester no approval section, and lets them view their own request", async () => {
    const user = userEvent.setup();
    renderRoute("/requests", page(), { user: "mock-user-bob" });
    expect(
      await screen.findByText("Track what you asked for. Approvers reply in the thread."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Awaiting your approval" }),
    ).not.toBeInTheDocument();
    await user.click(within(region("Your open requests")).getByRole("button", { name: "View" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("shows the empty states", async () => {
    mockState.world.requests = [];
    renderRoute("/requests", page(), { user: "mock-user-carol" });
    expect(await screen.findByText("Nothing to approve")).toBeInTheDocument();
    expect(screen.getByText("No open requests.")).toBeInTheDocument();
    expect(screen.getByText("No resolved requests yet.")).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    failList();
    const user = userEvent.setup();
    renderRoute("/requests", page());
    expect(await screen.findByText("Requests didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await findRegion("Awaiting your approval")).toBeInTheDocument();
  });

  it("shows a skeleton while a retry is loading", async () => {
    failList();
    const user = userEvent.setup();
    renderRoute("/requests", page());
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("requests-loading")).toBeInTheDocument();
  });
});

describe("requesting access", () => {
  onDesktop();

  it("opens from ?new=<secretId> and sends the request", async () => {
    const user = userEvent.setup();
    renderRoute("/requests?new=mock-secret-helpdesk", page(), { user: "mock-user-bob" });
    const dialog = await screen.findByRole("dialog", {
      name: "Request access to Helpdesk reset account",
    });
    await user.type(within(dialog).getByLabelText(/Why do you need it/), "Password reset rota");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(
      await screen.findByText("Request sent. An approver will look at it."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        within(region("Your open requests")).getByRole("row", { name: /Helpdesk reset account/ }),
      ).toBeInTheDocument(),
    );
    expect(mockState.world.requests.at(-1)?.reason).toBe("Password reset rota");
  });

  it("says so when a request for the secret is already open", async () => {
    renderRoute("/requests?new=mock-secret-acme-vpn", page(), { user: "mock-user-bob" });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/already asked for access/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("says so when the secret can't be found", async () => {
    renderRoute("/requests?new=mock-secret-alice-wifi", page(), { user: "mock-user-bob" });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/doesn't exist, or you can't see it/)).toBeInTheDocument();
  });
});

describe("U-09 requests, on a phone", () => {
  it("puts the lists behind tabs", async () => {
    const user = userEvent.setup();
    renderRoute("/requests", page());
    const tabs = await screen.findByRole("radiogroup", { name: "Show requests" });
    expect(within(tabs).getByRole("radio", { name: /^To approve \d+$/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Acme VPN/ })).toBeInTheDocument();
    await user.click(within(tabs).getByRole("radio", { name: "History" }));
    expect(await screen.findByRole("button", { name: /Payroll portal/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acme VPN/ })).not.toBeInTheDocument();
  });
});
