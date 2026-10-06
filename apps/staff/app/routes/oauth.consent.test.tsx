import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import {
  server,
  sessionCookie,
  withCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRoutesStub } from "react-router";

import * as consent from "@/routes/oauth.consent";

withMockGateway();

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("location", { ...globalThis.location, assign });
});
afterEach(() => vi.unstubAllGlobals());

const show = (url: string, { freshMfa = false } = {}) => {
  const cookie = sessionCookie("mock-user-alice");
  if (freshMfa) for (const s of mockState.sessions.values()) s.mfaVerifiedAt = Date.now();
  const Stub = createRoutesStub([
    {
      action: withCookie(cookie, consent.action),
      Component: consent.default,
      ErrorBoundary: consent.ErrorBoundary,
      HydrateFallback: () => null,
      loader: withCookie(cookie, consent.loader),
      path: "/oauth/consent",
      shouldRevalidate: consent.shouldRevalidate,
    } as never,
  ]);
  return render(<Stub initialEntries={[url]} />);
};

describe("G-10 agent consent", () => {
  it("asks whether to let the app act as the signed-in person", async () => {
    show("/oauth/consent?req=mock-consent-1");
    expect(
      await screen.findByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1:53682")).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Alice/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Allow" })).toBeDisabled();
  });

  it("allows with a second factor, refusing a wrong code first", async () => {
    const user = userEvent.setup();
    show("/oauth/consent?req=mock-consent-1");
    const name = await screen.findByRole("textbox", { name: "Token name" });
    await user.clear(name);
    await user.type(name, "laptop agent");
    await user.type(screen.getByLabelText("6-digit code"), "000000");
    await user.click(screen.getByRole("button", { name: "Allow" }));
    expect(await screen.findByText("That code didn't work.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("6-digit code"));
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Allow" }));
    expect(await screen.findByText("You can go back to the app")).toBeInTheDocument();
    expect(assign).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:53682\/callback\?/),
    );
    expect(mockState.world.tokens.at(-1)).toMatchObject({ label: "laptop agent" });
  });

  it("asks for no second factor right after sign-in", async () => {
    const user = userEvent.setup();
    show("/oauth/consent?req=mock-consent-1", { freshMfa: true });
    await screen.findByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" });
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Allow" }));
    expect(await screen.findByText("You can go back to the app")).toBeInTheDocument();
    expect(assign).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:53682\/callback\?/),
    );
  });

  it("shows the factor form when the gateway asks for a step-up", async () => {
    const user = userEvent.setup();
    show("/oauth/consent?req=mock-consent-1", { freshMfa: true });
    await screen.findByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" });
    // The window ran out between loading the page and answering it.
    server.use(
      http.post(
        `${MOCK_GATEWAY_URL}/oauth2/consent/:id`,
        () => HttpResponse.json({ error: "step_up_required" }, { status: 403 }),
        { once: true },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Allow" }));
    expect(await screen.findByText("Confirm it's you.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Allow" }));
    expect(await screen.findByText("You can go back to the app")).toBeInTheDocument();
  });

  it("denies, and the app gets no token", async () => {
    const user = userEvent.setup();
    show("/oauth/consent?req=mock-consent-1");
    await user.click(await screen.findByRole("button", { name: "Deny" }));
    expect(await screen.findByText("Request denied")).toBeInTheDocument();
    expect(assign).toHaveBeenCalledWith(expect.stringContaining("error=access_denied"));
  });

  it("says when the page was opened without a request, or the request expired", async () => {
    show("/oauth/consent");
    expect(await screen.findByText("Can't continue this sign-in")).toBeInTheDocument();
  });

  it("says when the request expired", async () => {
    show("/oauth/consent?req=mock-consent-expired");
    expect(await screen.findByText("This request expired")).toBeInTheDocument();
  });

  it("shows an error with Retry when the gateway fails, and loads once it answers", async () => {
    server.use(
      http.get(`${MOCK_GATEWAY_URL}/oauth2/consent/:id`, () =>
        HttpResponse.json({ error: "temporarily_unavailable" }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    show("/oauth/consent?req=mock-consent-1");
    expect(await screen.findByText("This sign-in didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" }),
    ).toBeInTheDocument();
  });
});
