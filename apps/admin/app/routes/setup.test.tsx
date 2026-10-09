import { MOCK_SETUP_TOKEN, mockState, USERS } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import * as setup from "@/routes/setup";

withMockGateway();

beforeEach(() => {
  mockState.needsSetup = true;
});

const renderSetup = () => {
  const Stub = createRoutesStub([
    {
      action: setup.action as never,
      Component: setup.default,
      HydrateFallback: () => null,
      path: "/setup",
    },
    { Component: () => <h1>Sign in</h1>, path: "/sign-in" },
  ]);
  render(<Stub initialEntries={["/setup"]} />);
};

const fillAdmin = async (user: ReturnType<typeof userEvent.setup>, token: string) => {
  await user.type(screen.getByLabelText(/Username/), "frank");
  await user.type(screen.getByLabelText(/Display name/), "Frank");
  await user.type(screen.getByLabelText(/Email/), "frank@example.org");
  await user.type(screen.getByLabelText(/^Password/), "correct horse battery");
  await user.type(screen.getByLabelText(/Confirm password/), "correct horse battery");
  await user.type(screen.getByLabelText(/Setup token/), token);
};

describe("first-run setup", () => {
  it("creates the root admin, installs the built-ins, verifies the email and says it's ready", async () => {
    const user = userEvent.setup();
    renderSetup();
    await fillAdmin(user, MOCK_SETUP_TOKEN);
    await user.click(screen.getByRole("button", { name: "Create admin" }));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByText(/secret types, .* connections and .* folders/)).toBeInTheDocument();
    const frank = USERS.find((u) => u.username === "frank");
    expect(frank?.isRoot).toBe(true);
    expect(mockState.needsSetup).toBe(false);

    await user.type(screen.getByLabelText("6-digit code"), "000000");
    expect(await screen.findByText(/That code is wrong/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("6-digit code"), "481027");
    expect(await screen.findByRole("heading", { name: "You're all set" })).toBeInTheDocument();
    expect(screen.queryByTitle("Replay")).not.toBeInTheDocument();
    expect(frank?.emailVerified).toBe(true);
    expect(screen.getByRole("link", { name: "Continue to sign-in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("says when the setup token is wrong, keeping what was typed", async () => {
    const user = userEvent.setup();
    renderSetup();
    await fillAdmin(user, "not-the-token");
    await user.click(screen.getByRole("button", { name: "Create admin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That setup token is not valid");
    expect(screen.getByLabelText(/Username/)).toHaveValue("frank");
    expect(mockState.needsSetup).toBe(true);
  });

  it("won't send mismatched or short passwords", async () => {
    const user = userEvent.setup();
    renderSetup();
    await user.type(screen.getByLabelText(/^Password/), "short");
    expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Confirm password/), "different");
    expect(screen.getByText("Doesn't match.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create admin" })).toBeDisabled();
  });

  it("lets the email check wait until later", async () => {
    const user = userEvent.setup();
    renderSetup();
    await fillAdmin(user, MOCK_SETUP_TOKEN);
    await user.click(screen.getByRole("button", { name: "Create admin" }));
    await user.click(await screen.findByRole("button", { name: /Skip for now/ }));
    expect(await screen.findByText(/isn't verified yet/)).toBeInTheDocument();
  });

  it("keeps the setup stepper on one line: no flex-wrap, and step names read to screen readers only", async () => {
    renderSetup();
    const steps = await screen.findByRole("list", { name: "Setup steps" });
    expect(steps.className).not.toContain("flex-wrap");
    // "Ready" (the step that wrapped, issue #241) is reachable for a screen reader, but never
    // as flowing text that could wrap.
    expect(screen.getByText(/: Ready$/, { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.queryByText("Ready", { selector: ":not(.sr-only)" })).not.toBeInTheDocument();
  });
});

describe("the setup page once an admin exists", () => {
  it("sends people to sign in", async () => {
    mockState.needsSetup = false;
    const { appRequest } = await import("@sneakers-web/mock-gateway/testing");
    const r = await setup
      .loader({ context: {}, params: {}, request: appRequest("/setup") } as never)
      .catch((error: unknown) => error);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/sign-in");
  });
});
