import { MOCK_GATEWAY_URL, mockState } from "@sneakers-pam/mock-server/in-process";
import { server, withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { TargetsOpenSshSessionDocument, TargetsTerminalDocument } from "@sneakers-web/api-client";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { TerminalDeps } from "@/features/targets/terminal/deps";
import type { Connect, SessionEvents } from "@/features/targets/terminal/session";
import type { StubRoute } from "@/test/routeStub";

import { TerminalDepsContext } from "@/features/targets/terminal/deps";
import { openSocket } from "@/features/targets/terminal/socket";
import { fakeScreens } from "@/features/targets/terminal/testing";
import { connectSession } from "@/features/targets/terminal/transport";
import * as hostKeyPinRoute from "@/routes/resources.host-key-pin";
import * as terminal from "@/routes/terminal";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const KEY = "mock-secret-build-ssh";
const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

const page = (deps: TerminalDeps): StubRoute[] => [
  {
    action: terminal.action,
    Component: () => (
      <TerminalDepsContext value={deps}>
        <terminal.default />
      </TerminalDepsContext>
    ),
    ErrorBoundary: terminal.ErrorBoundary,
    loader: terminal.loader,
    path: "/secret/:id/terminal",
  },
  { action: hostKeyPinRoute.action, path: "/resources/host-key-pin" },
];

const output = async (text: RegExp | string) =>
  expect(await screen.findByTestId("terminal-output")).toHaveTextContent(text);

/** A session the test opens or fails by hand, recording what the page sends it. */
const heldSession = () => {
  const sent: string[] = [];
  const attempts: SessionEvents[] = [];
  const connect: Connect = (_ticket, _info, events) => {
    attempts.push(events);
    return Promise.resolve({
      close: () => {},
      resize: () => {},
      send: (data) => sent.push(data),
    });
  };
  return { attempts, connect, sent };
};

const openHeld = async () => {
  vi.stubEnv("SNEAKERS_MOCK", "true");
  const held = heldSession();
  const screens = fakeScreens();
  renderRoute(
    `/secret/${KEY}/terminal`,
    page({ connect: held.connect, createScreen: screens.create }),
  );
  await vi.waitFor(() => expect(held.attempts).toHaveLength(1));
  return { ...held, screen: () => screens.last()! };
};

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

  describe("typing before the session opens", () => {
    it("sends the keys in order once it's open", async () => {
      const held = await openHeld();
      held.screen().type("wh");
      held.screen().type("oami\r");
      expect(held.sent).toEqual([]);
      act(() => held.attempts[0]!.onOpen());
      expect(await screen.findByText("Connected")).toBeInTheDocument();
      held.screen().type("ls\r");
      expect(held.sent).toEqual(["wh", "oami\r", "ls\r"]);
    });

    it("keeps nothing for the next attempt when the session fails", async () => {
      const held = await openHeld();
      const user = userEvent.setup();
      held.screen().type("secret-typed-early");
      act(() => held.attempts[0]!.onClose({ kind: "failed", started: false }));
      const [reconnect] = await screen.findAllByRole("button", { name: "Reconnect" });
      await user.click(reconnect!);
      await vi.waitFor(() => expect(held.attempts).toHaveLength(2));
      act(() => held.attempts[1]!.onOpen());
      expect(await screen.findByText("Connected")).toBeInTheDocument();
      expect(held.sent).toEqual([]);
    });
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
    // On the page's own origin, whatever host the gateway's URL names.
    expect(urls[0]).toMatch(
      new RegExp(String.raw`^ws://${globalThis.location.host}/ssh/session\?ticket=mock-ticket-`),
    );
    await output("Opening session to build1.example.org with the stored key…");
    vi.unstubAllGlobals();
  });

  it("says which step of a live open failed, from the broker's close", async () => {
    class Socket {
      static readonly OPEN = 1;
      readyState = 0;
      private close_?: (event: { code: number; reason: string }) => void;
      constructor() {
        queueMicrotask(() =>
          this.close_?.({ code: 1011, reason: "can't reach 192.0.2.10:22: connection timed out" }),
        );
      }
      addEventListener(type: string, listener: (event: { code: number; reason: string }) => void) {
        if (type === "close") this.close_ = listener;
      }
      close() {}
      send() {}
    }
    vi.stubGlobal("WebSocket", Socket);
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: openSocket, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText("Connection error")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The SSH session couldn't start: can't reach 192.0.2.10:22: connection timed out. The key was not shown to anyone.",
      ),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("names the address it tried when the box's terminal service can't be reached", async () => {
    class Socket {
      static readonly OPEN = 1;
      readyState = 0;
      private close_?: (event: { code: number; reason: string }) => void;
      constructor() {
        queueMicrotask(() => this.close_?.({ code: 1006, reason: "" }));
      }
      addEventListener(type: string, listener: (event: { code: number; reason: string }) => void) {
        if (type === "close") this.close_ = listener;
      }
      close() {}
      send() {}
    }
    vi.stubGlobal("WebSocket", Socket);
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: openSocket, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText("Connection error")).toBeInTheDocument();
    expect(
      screen.getByText(
        `The SSH session couldn't start: couldn't reach the box's terminal service at ${globalThis.location.host}. The key was not shown to anyone.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reconnect" }).length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("shows an error, not a spinner, when the session can't be set up at all", async () => {
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({
        connect: () => Promise.reject(new Error("no transport")),
        createScreen: fakeScreens().create,
      }),
    );
    expect(await screen.findByText("Connection error")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The SSH session couldn't start: the ticket ran out, or the host didn't answer. The key was not shown to anyone.",
      ),
    ).toBeInTheDocument();
  });

  it("says which service didn't answer when the ticket request times out", async () => {
    server.use(
      gateway.mutation(TargetsOpenSshSessionDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: { code: "DEADLINE_EXCEEDED" },
              message:
                "rpc error: code = DeadlineExceeded desc = the SSH broker didn't answer within 15s while opening the session",
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
      screen.getByText(/the SSH broker didn't answer within 15s while opening the session/),
    ).toBeInTheDocument();
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

  it("names a host the broker won't reach because its key isn't pinned, boxed and centred", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.sshHostKeys = [];
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(await screen.findByText(/This host has no pinned SSH host key/)).toBeInTheDocument();
    const box = screen.getByRole("alert");
    expect(box.className).toContain("mx-auto");
    expect(box.className).toContain("inset-x-5");
    expect(screen.getByRole("button", { name: "Pin the host key" })).toBeInTheDocument();
  });

  it("shows an unpinned host straight from the ticket answer, with no socket opened", async () => {
    server.use(
      gateway.mutation(TargetsOpenSshSessionDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: {
                code: "FAILED_PRECONDITION",
                domain: "sneakers.sshbroker",
                metadata: { target_id: "mock-target-build1" },
                reason: "HOST_KEY_NOT_PINNED",
              },
              message:
                "rpc error: code = FailedPrecondition desc = host key not pinned for this target: an admin pins it on the target first; no connection was made",
            },
          ],
        } as never),
      ),
    );
    const connect = vi.fn(connectSession);
    renderRoute(`/secret/${KEY}/terminal`, page({ connect, createScreen: fakeScreens().create }));
    expect(await screen.findByText(/This host has no pinned SSH host key/)).toBeInTheDocument();
    expect(screen.getByText("Connection error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pin the host key" })).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });

  it("tells someone who can't pin where an admin pins the host key", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const target = mockState.world.targets.find((t) => t.id === "mock-target-build1")!;
    target.sshHostKeys = [];
    target.ownerUserId = undefined;
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
      { user: "mock-user-bob" },
    );
    const where =
      "An admin pins it on the target's page in the admin app: /admin/targets/mock-target-build1, Scan and pin….";
    expect(
      await screen.findByText(
        (_, element) => element?.tagName === "SPAN" && element.textContent === where,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin the host key" })).not.toBeInTheDocument();
  });

  it("hides the pin action from someone who isn't a site admin or root", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const target = mockState.world.targets.find((t) => t.id === "mock-target-build1")!;
    target.sshHostKeys = [];
    target.ownerUserId = undefined;
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
      { user: "mock-user-bob" },
    );
    expect(await screen.findByText(/This host has no pinned SSH host key/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin the host key" })).not.toBeInTheDocument();
  });

  it("scans, pins on confirm, and reconnects with the newly pinned key", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.sshHostKeys = [];
    const user = userEvent.setup();
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    await user.click(await screen.findByRole("button", { name: "Pin the host key" }));
    expect(await screen.findByRole("heading", { name: "Pin the host key" })).toBeInTheDocument();
    expect(await screen.findByText(/SHA256:/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pin this key" }));
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(
      mockState.world.targets.find((t) => t.id === "mock-target-build1")!.sshHostKeys,
    ).toHaveLength(1);
  });

  it("says when the secret isn't an SSH key bound to a target", async () => {
    renderRoute(
      "/secret/mock-secret-edge-router/terminal",
      page({ connect: connectSession, createScreen: fakeScreens().create }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "This secret can't open a terminal",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attach a target" })).toHaveAttribute(
      "href",
      "/secret/mock-secret-edge-router/edit",
    );
  });

  it("asks for access when the key is locked", async () => {
    // Dave isn't in the Platform engineers group and holds no lease, so nothing lets him read it.
    // A shared target, so the key's lock is all that stands in his way.
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.ownerUserId = undefined;
    renderRoute(
      `/secret/${KEY}/terminal`,
      page({ connect: connectSession, createScreen: fakeScreens().create }),
      { user: "mock-user-dave" },
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
