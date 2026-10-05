import type { MockSecretUse } from "@sneakers-web/mock-gateway";

import { MOCK_MFA_MAX_AGE_MS, mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as run from "@/routes/approvals.run";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const RUN = "run_mock_build1";
const URL_ = `/approvals/run/${RUN}`;

const page = (): StubRoute => ({
  action: run.action as StubRoute["action"],
  Component: run.default,
  ErrorBoundary: run.ErrorBoundary,
  loader: run.loader as StubRoute["loader"],
  path: "/approvals/run/:runId",
});

const nowUnix = () => Math.floor(Date.now() / 1000);
const world = () => mockState.world;
const secretUse = (id: string) => world().secretUses.find((u) => u.id === id)!;

const raise = (id: string, over: Partial<MockSecretUse> = {}) =>
  world().secretUses.push({
    ...secretUse("mock-use-1"),
    argv: [],
    expiresAtUnix: nowUnix() + 300,
    fieldKey: "token",
    id,
    reveal: true,
    secretId: "mock-secret-status-api",
    secretName: "Status page API",
    ...over,
  });

/** Every mock session passed a step-up just now, so the factor window is open. */
const stepUpNow = (at = Date.now()) => {
  for (const s of mockState.sessions.values()) s.mfaVerifiedAt = at;
};

const show = () => renderRoute(URL_, page());
const card = (name: RegExp | string) => screen.getByRole("group", { name });
const tick = (name: string) => screen.getByRole("checkbox", { name: `Include ${name}` });
const code = () => screen.getByLabelText("6-digit code");

describe("U-14b one approval page for an agent run", () => {
  it("names who asked and why, and lists every use ticked", async () => {
    raise("mock-use-reveal");
    show();
    expect(
      await screen.findByRole("heading", { name: /build1 agent is waiting on 2 requests/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Agent says" })).toHaveTextContent(
      secretUse("mock-use-1").purpose!,
    );
    const adminCard = card(/DB admin/);
    expect(
      within(adminCard).getByText("psql -h db1.example.org -U postgres_admin"),
    ).toBeInTheDocument();
    expect(within(adminCard).getByRole("timer")).toBeInTheDocument();
    expect(within(adminCard).queryByText("Reveals value to agent")).not.toBeInTheDocument();
    const reveal = card(/Status page API/);
    expect(within(reveal).getByText("Reveals value to agent")).toBeInTheDocument();
    expect(within(reveal).getByText("Reveal to the agent")).toBeInTheDocument();
    expect(tick("DB admin")).toBeChecked();
    expect(tick("Status page API")).toBeChecked();
    expect(screen.getByRole("button", { name: "Approve 2 requests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny all" })).toBeInTheDocument();
  });

  it("counts the ticks on both buttons", async () => {
    raise("mock-use-reveal");
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Include Status page API" }));
    expect(screen.getByRole("button", { name: "Approve 1 request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny 1" })).toBeInTheDocument();
    await user.click(tick("DB admin"));
    expect(screen.getByRole("button", { name: "Approve 0 requests" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deny 0" })).toBeDisabled();
  });

  it("approves the ticked uses with one code, refusing a wrong one first", async () => {
    raise("mock-use-reveal");
    raise("mock-use-left", { secretName: "Backup bucket" });
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Include Backup bucket" }));
    await user.type(code(), "000000");
    await user.click(screen.getByRole("button", { name: "Approve 2 requests" }));
    expect(
      await screen.findByText("That code didn't work. Nothing was approved."),
    ).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("pending");
    await user.clear(code());
    await user.type(code(), "123456");
    await user.click(screen.getByRole("button", { name: "Approve 2 requests" }));
    const done = await screen.findByRole("region", { name: /Approved/ });
    expect(within(done).getByText(/collect these within 60 seconds/)).toBeInTheDocument();
    expect(within(done).getByText(/DB admin/)).toBeInTheDocument();
    expect(within(done).getByText(/Status page API/)).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("approved");
    expect(secretUse("mock-use-reveal").state).toBe("approved");
    expect(secretUse("mock-use-left").state).toBe("pending");
    await user.click(await screen.findByRole("button", { name: "1 request still waiting" }));
    expect(tick("Backup bucket")).toBeInTheDocument();
  });

  it("asks for no factor while the session's step-up still covers an approval", async () => {
    show();
    stepUpNow();
    expect(await screen.findByText(/Verified, good until \d\d:\d\d/)).toBeInTheDocument();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve 1 request" }));
    expect(await screen.findByRole("region", { name: /Approved/ })).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("approved");
  });

  it("asks for the factor again when the window closed before the click, keeping the ticks", async () => {
    raise("mock-use-reveal");
    const user = userEvent.setup();
    show();
    stepUpNow();
    await screen.findByText(/Verified, good until/);
    await user.click(screen.getByRole("checkbox", { name: "Include Status page API" }));
    stepUpNow(Date.now() - MOCK_MFA_MAX_AGE_MS - 1000);
    await user.click(screen.getByRole("button", { name: "Approve 1 request" }));
    expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
    expect(screen.getByText(/Your verification ran out/)).toBeInTheDocument();
    expect(tick("Status page API")).not.toBeChecked();
    expect(tick("DB admin")).toBeChecked();
    expect(secretUse("mock-use-1").state).toBe("pending");
  });

  it("denies the ticked uses without a factor", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "Deny all" }));
    const done = await screen.findByRole("region", { name: /Denied/ });
    expect(within(done).getByText(/DB admin/)).toBeInTheDocument();
    expect(secretUse("mock-use-1").state).toBe("denied");
  });

  it("shows a refused item with its reason, beside what was decided", async () => {
    raise("mock-use-reveal");
    const user = userEvent.setup();
    show();
    await screen.findByRole("checkbox", { name: "Include Status page API" });
    secretUse("mock-use-reveal").state = "denied";
    await user.click(screen.getByRole("button", { name: "Deny all" }));
    const refused = await screen.findByRole("region", { name: /Not decided/ });
    expect(within(refused).getByText(/Status page API/)).toBeInTheDocument();
    expect(within(refused).getByText(/It was already decided/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Denied/ })).toHaveTextContent("DB admin");
  });

  it("shows each card's own task when the uses give different ones", async () => {
    raise("mock-use-other", { purpose: "Rotate the status page key" });
    show();
    await screen.findByRole("checkbox", { name: "Include Status page API" });
    expect(screen.queryByRole("note", { name: "Agent says" })).not.toBeInTheDocument();
    expect(card(/Status page API/)).toHaveTextContent("Agent says: Rotate the status page key");
    expect(card(/DB admin/)).toHaveTextContent(`Agent says: ${secretUse("mock-use-1").purpose!}`);
  });

  it("says when nothing in the run is waiting, with a way to every approval", async () => {
    secretUse("mock-use-1").expiresAtUnix = nowUnix() - 1;
    show();
    expect(await screen.findByText("Nothing waiting in this run")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All approvals" })).toHaveAttribute(
      "href",
      "/approvals",
    );
  });
});
