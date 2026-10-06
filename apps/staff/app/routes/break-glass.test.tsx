import { mockBreakGlass } from "@sneakers-web/mock-gateway";
import { appRequest, sessionCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as breakGlass from "@/routes/break-glass";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const page = (): StubRoute => ({
  action: breakGlass.action,
  Component: breakGlass.default,
  ErrorBoundary: breakGlass.ErrorBoundary,
  loader: breakGlass.loader,
  path: "/break-glass",
});

const openSession = async (user: ReturnType<typeof userEvent.setup>) => {
  renderRoute("/break-glass", page());
  const go = await screen.findByRole("button", { name: "Break glass" });
  expect(go).toBeDisabled();
  await user.type(screen.getByLabelText(/Reason/), "Bob is away and the build key expired.");
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(go);
  return screen.findByRole("navigation", { name: "All folders" });
};

describe("break-the-glass mode", () => {
  it("is only for site admins", async () => {
    const request = appRequest("/break-glass", { cookie: sessionCookie("mock-user-bob") });
    await expect(
      breakGlass.loader({ context: {}, params: {}, request } as never),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("asks for a reason and a code, and says when the code is wrong", async () => {
    const user = userEvent.setup();
    renderRoute("/break-glass", page());
    expect(await screen.findByRole("heading", { name: "Break the glass?" })).toBeInTheDocument();
    expect(screen.getByText(/Each reveal alerts the secret's owners/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reason/), "Outage");
    await user.type(screen.getByLabelText("6-digit code"), "000000");
    await user.click(screen.getByRole("button", { name: "Break glass" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Try again.");
    expect(mockBreakGlass.sessions).toHaveLength(0);
  });

  it("lists every folder, other people's personal ones included, once it's open", async () => {
    const user = userEvent.setup();
    const nav = await openSession(user);
    expect(mockBreakGlass.sessions).toHaveLength(1);
    expect(mockBreakGlass.sessions[0]?.reason).toBe("Bob is away and the build key expired.");
    const bob = within(nav).getByRole("button", { name: "Personal: Bob / My secrets" });
    await user.click(bob);
    expect(
      await screen.findByRole("heading", { name: "Personal: Bob / My secrets" }),
    ).toBeInTheDocument();
    const secrets = screen.getByRole("list", { name: "Secrets" });
    expect(within(secrets).getByText("Laptop login")).toBeInTheDocument();
  });

  it("reveals a secret as a break-glass reveal and says the owners are notified", async () => {
    const user = userEvent.setup();
    const nav = await openSession(user);
    await user.click(within(nav).getByRole("button", { name: "Personal: Bob / My secrets" }));
    await user.click(await screen.findByRole("button", { name: "Reveal Laptop login" }));
    const dialog = await screen.findByRole("dialog", { name: "Reveal Laptop login?" });
    expect(dialog).toHaveTextContent("The secret's owners will be notified");
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await user.click(within(dialog).getByRole("button", { name: "Reveal" }));
    const reveal = await screen.findByRole("region", { name: "Break-glass reveal" });
    expect(within(reveal).getByText("mock-Bob-Brogue-77")).toBeInTheDocument();
    const session = mockBreakGlass.sessions[0]!;
    expect(session.reveals).toEqual([
      expect.objectContaining({ ownerNotified: true, secretId: "mock-secret-bob-laptop" }),
    ]);
  });

  it("goes back to the open form once the session has ended", async () => {
    const user = userEvent.setup();
    await openSession(user);
    const session = mockBreakGlass.sessions[0]!;
    session.endedAt = Date.now();
    session.endReason = "expired";
    renderRoute("/break-glass", page());
    expect(await screen.findAllByRole("heading", { name: "Break the glass?" })).not.toHaveLength(0);
  });
});
