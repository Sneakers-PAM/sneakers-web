import { MOCK_GATEWAY_URL, mockState, USERS } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import * as stepUpRoute from "@/routes/resources.step-up";
import * as security from "@/routes/security";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const routes = [
  {
    action: security.action,
    Component: () => (
      <>
        <security.default />
        <Toaster />
      </>
    ),
    ErrorBoundary: security.ErrorBoundary,
    loader: security.loader,
    path: "/security",
  },
  { action: stepUpRoute.action, path: "/resources/step-up" },
];

const open = (user?: string, url = "/security") => renderRoute(url, routes, { user });
const method = (name: string) => screen.getByRole("group", { name });
const factors = (id: string) => USERS.find((u) => u.id === id)!.factors;

const confirmStepUp = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
  await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
};

describe("U-17 security", () => {
  it("shows the user's sign-in methods", async () => {
    open();
    expect(await screen.findByRole("heading", { level: 1, name: "Security" })).toBeInTheDocument();
    const app = method("Authenticator app");
    expect(within(app).getByText(/^Added \d{1,2} \w+ \d{4}\.$/)).toBeInTheDocument();
    expect(within(app).getByRole("button", { name: "Remove…" })).toBeInTheDocument();
    const passkeys = method("Passkeys");
    expect(within(passkeys).getByText("None yet. Faster than a code.")).toBeInTheDocument();
    expect(within(passkeys).getByRole("button", { name: "Add passkey" })).toBeInTheDocument();
    const email = method("Email codes");
    expect(within(email).getByText("alice@example.org")).toBeInTheDocument();
    expect(within(email).getByText("On")).toBeInTheDocument();
    expect(screen.getByText("Removing your authenticator")).toBeInTheDocument();
  });

  it("nudges someone with no second factor to add one", async () => {
    open("mock-user-bob");
    expect(await screen.findByText("No second factor yet")).toBeInTheDocument();
    const app = method("Authenticator app");
    expect(
      within(app).getByText("Not set up. Codes from an app on your phone."),
    ).toBeInTheDocument();
    expect(within(app).getByRole("button", { name: "Set up" })).toBeInTheDocument();
    expect(within(method("Email codes")).getByText("On")).toBeInTheDocument();
    expect(screen.queryByText("Removing your authenticator")).not.toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      http.get(`${MOCK_GATEWAY_URL}/auth/mfa/factors`, () =>
        HttpResponse.json({ error: "identity_unreachable" }, { status: 502 }),
      ),
    );
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Security didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("group", { name: "Authenticator app" })).toBeInTheDocument();
  });

  it("removes the authenticator after a confirm and a step-up, ending the session", async () => {
    const user = userEvent.setup();
    open();
    await user.click(
      within(await screen.findByRole("group", { name: "Authenticator app" })).getByRole("button", {
        name: "Remove…",
      }),
    );
    const confirm = await screen.findByRole("alertdialog", { name: "Remove your authenticator?" });
    await user.click(within(confirm).getByRole("button", { name: "Remove authenticator" }));
    await confirmStepUp(user);
    await waitFor(() => expect(factors("mock-user-alice")).toEqual(["email"]));
    // The redirect itself is covered by the action test; here the session is gone.
    expect(mockState.sessions.size).toBe(0);
  });

  it("says why the last factor can't go when MFA is required", async () => {
    USERS.find((u) => u.id === "mock-user-dave")!.factors = ["totp", "email"];
    const user = userEvent.setup();
    open("mock-user-dave");
    await user.click(
      within(await screen.findByRole("group", { name: "Authenticator app" })).getByRole("button", {
        name: "Remove…",
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Remove authenticator" }));
    await confirmStepUp(user);
    expect(
      await screen.findByText(
        "Your administrator requires a second factor. Add another one before removing this one.",
      ),
    ).toBeInTheDocument();
    expect(factors("mock-user-dave")).toEqual(["totp", "email"]);
  });

  it("sets up an authenticator (D-21), marking a wrong code", async () => {
    const user = userEvent.setup();
    open("mock-user-bob");
    await user.click(
      within(await screen.findByRole("group", { name: "Authenticator app" })).getByRole("button", {
        name: "Set up",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Set up a second factor" });
    expect(within(dialog).getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    const code = within(dialog).getByLabelText("6-digit code");
    await user.type(code, "000000");
    expect(await within(dialog).findByText(/That code didn.t match/)).toBeInTheDocument();
    await user.clear(code);
    await user.type(code, "123456");
    expect(await screen.findByText("Authenticator app added.")).toBeInTheDocument();
    expect(
      await within(screen.getByRole("group", { name: "Authenticator app" })).findByRole("button", {
        name: "Remove…",
      }),
    ).toBeInTheDocument();
    expect(factors("mock-user-bob")).toEqual(["totp"]);
  });

  it("opens the setup straight away for ?setup=authenticator", async () => {
    open("mock-user-bob", "/security?setup=authenticator");
    expect(
      await screen.findByRole("dialog", { name: "Set up a second factor" }),
    ).toBeInTheDocument();
  });

  it("says when the browser can't use passkeys", async () => {
    open();
    const passkeys = await screen.findByRole("group", { name: "Passkeys" });
    // jsdom has no WebAuthn.
    expect(within(passkeys).getByRole("button", { name: "Add passkey" })).toBeDisabled();
    expect(passkeys).toHaveTextContent("This browser can't use passkeys.");
  });
});
