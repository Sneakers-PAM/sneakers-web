import { TargetsOpenSshSessionDocument, TargetsTerminalDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { TerminalDeps } from "@/features/targets/terminal/deps";
import type { StubRoute } from "@/test/routeStub";

import { TerminalDepsContext } from "@/features/targets/terminal/deps";
import { openSocket } from "@/features/targets/terminal/socket";
import { fakeScreens } from "@/features/targets/terminal/testing";
import { connectSession } from "@/features/targets/terminal/transport";
import * as terminal from "@/routes/terminal";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const KEY = "mock-secret-build-ssh";
const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

const page = (deps: TerminalDeps): StubRoute => ({
  action: terminal.action,
  Component: () => (
    <TerminalDepsContext value={deps}>
      <terminal.default />
    </TerminalDepsContext>
  ),
  ErrorBoundary: terminal.ErrorBoundary,
  loader: terminal.loader,
  path: "/secret/:id/terminal",
});

const output = async (text: RegExp | string) =>
  expect(await screen.findByTestId("terminal-output")).toHaveTextContent(text);

describe("U-12 terminal", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("opens a mock session on a ticket from the gateway, and types into it", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const screens = fakeScreens();
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: screens.create }),
    );
    expect(await screen.findByText("Build host deploy key")).toBeInTheDocument();
    expect(screen.getByText("deploy@build1.example.org")).toBeInTheDocument();
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    await output("MOCK SESSION: no real host is connected");
    screens.last()!.type("whoami\r");
    await output("$ whoami deploy");
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", `/secret/${KEY}`);
  });

  it("shows the session ending, and reconnects on a new ticket", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const tickets: string[] = [];
    const screens = fakeScreens();
    const user = userEvent.setup();
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({
        connect: (ticket, info, events) => {
          tickets.push(ticket.ticket);
          return connectSession(ticket, info, events);
        },
        createScreen: screens.create,
      }),
    );
    await screen.findByText("Connected");
    screens.last()!.type("exit\r");
    expect(await screen.findByText("Session closed")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Reconnect" })[0]!);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).not.toBe(tickets[1]);
  });

  it("dials the broker's WebSocket with the ticket in a live build", async () => {
    const urls: string[] = [];
    class Socket {
      static readonly OPEN = 1;
      readyState = 0;
      constructor(url: string) {
        urls.push(url);
      }
      addEventListener() {}
      close() {}
      send() {}
    }
    vi.stubGlobal("WebSocket", Socket);
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: openSocket, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText("Connecting…")).toBeInTheDocument();
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toMatch(
      /^mock-ssh:\/\/mock-gateway\.example\.invalid\/ssh\/session\?ticket=mock-ticket-/,
    );
    await output("Opening session to build1.example.org with the stored key…");
    vi.unstubAllGlobals();
  });

  it("explains a refused session, and keeps the key unseen", async () => {
    server.use(
      gateway.mutation(TargetsOpenSshSessionDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: { code: "UNAVAILABLE" },
              message: "rpc error: code = Unavailable desc = sshbroker unavailable",
            },
          ],
        } as never),
      ),
    );
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText("Connection error")).toBeInTheDocument();
    expect(
      screen.getByText("A service behind the gateway isn't answering. Try again in a moment."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to secret" })).toBeInTheDocument();
  });

  it("names a host the broker won't reach because its key isn't pinned", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.sshHostKeys = [];
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText(/This host has no pinned SSH host key/)).toBeInTheDocument();
  });

  it("says when the secret isn't an SSH key bound to a target", async () => {
    renderRoute(
      "/secret/mock-secret-edge-router/terminal",
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "This secret isn't an SSH key bound to a target",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attach a target" })).toHaveAttribute(
      "href",
      "/secret/mock-secret-edge-router/edit",
    );
  });

  it("asks for access when the key is locked", async () => {
    mockState.world.secrets.find((s) => s.id === KEY)!.canRead = false;
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByRole("link", { name: "Request access" })).toHaveAttribute(
      "href",
      `/requests?new=${KEY}`,
    );
  });

  it("shows an error with Retry when the page doesn't load", async () => {
    server.use(
      gateway.query(TargetsTerminalDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText("The terminal didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Build host deploy key")).toBeInTheDocument();
  });

  it("says so when the secret doesn't exist", async () => {
    renderRoute(
      "/secret/mock-secret-nope/terminal",
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(
      await screen.findByText("That secret doesn't exist, or you can't see it."),
    ).toBeInTheDocument();
  });
});
