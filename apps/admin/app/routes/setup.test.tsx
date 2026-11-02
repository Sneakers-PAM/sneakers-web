import { MOCK_SETUP_TOKEN, mockState, USERS } from "@sneakers-pam/mock-server/in-process";
import {
  appRequest,
  form,
  server,
  withMockGateway,
} from "@sneakers-pam/mock-server/in-process/testing";
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

const gatewayPaths = (): string[] => {
  const paths: string[] = [];
  server.events.on("request:start", ({ request }) => {
    paths.push(new URL(request.url).pathname);
  });
  return paths;
};

const post = (body: BodyInit, contentType?: string) =>
  setup.action({
    context: {},
    params: {},
    request: appRequest("/setup", {
      body,
      headers: contentType ? { "Content-Type": contentType } : {},
      method: "POST",
    }),
  } as never);

const statusOf = (r: unknown): number =>
  r instanceof Response ? r.status : ((r as { init?: { status?: number } }).init?.status ?? 200);

describe("the setup action's refusals", () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it("answers a JSON body with 415, not a 500, and never reaches the gateway", async () => {
    const paths = gatewayPaths();
    const r = await post(
      JSON.stringify({ intent: "create", setupToken: "not-the-token" }),
      "application/json",
    );
    expect(statusOf(r)).toBe(415);
    expect(paths).toEqual([]);
  });

  it("answers a body with no content type with 415", async () => {
    const r = await post("intent=create");
    expect(statusOf(r)).toBe(415);
  });

  it("answers a form body it can't read with 400", async () => {
    const r = await post("--broken", "multipart/form-data; boundary=nothing-matches");
    expect(statusOf(r)).toBe(400);
  });

  it("answers a wrong setup token with a 4xx and creates nobody", async () => {
    const r = await post(
      form({
        confirm: "correct horse battery",
        email: "frank@example.org",
        intent: "create",
        name: "Frank",
        password: "correct horse battery",
        setupToken: "not-the-token",
        username: "frank",
      }),
    );
    expect(statusOf(r)).toBe(400);
    expect(USERS.some((u) => u.username === "frank")).toBe(false);
  });

  it("answers a missing setup token with a 4xx without calling the gateway's bootstrap", async () => {
    const paths = gatewayPaths();
    const r = await post(
      form({
        confirm: "correct horse battery",
        email: "frank@example.org",
        intent: "create",
        name: "Frank",
        password: "correct horse battery",
        username: "frank",
      }),
    );
    expect(statusOf(r)).toBe(400);
    expect(paths).not.toContain("/setup/bootstrap");
  });
});

// These run last: once the shell has seen an administrator it remembers that for the process,
// as the real server does.
describe("the setup page once an admin exists", () => {
  it("refuses a create the way the loader does, without calling the gateway's bootstrap", async () => {
    mockState.needsSetup = false;
    const paths = gatewayPaths();
    const r = await post(
      form({
        confirm: "correct horse battery",
        email: "frank@example.org",
        intent: "create",
        name: "Frank",
        password: "correct horse battery",
        setupToken: MOCK_SETUP_TOKEN,
        username: "frank",
      }),
    ).catch((error: unknown) => error);
    server.events.removeAllListeners();
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/sign-in");
    expect(paths).not.toContain("/setup/bootstrap");
    expect(USERS.some((u) => u.username === "frank")).toBe(false);
  });

  it("sends people to sign in", async () => {
    mockState.needsSetup = false;
    const r = await setup
      .loader({ context: {}, params: {}, request: appRequest("/setup") } as never)
      .catch((error: unknown) => error);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/sign-in");
  });
});
