import type { SessionEvents } from "@/features/targets/terminal/session";

import {
  BROKER_OPEN_LIMIT_MS,
  OPEN_TIMEOUT_MS,
  openSocket,
  sessionUrl,
} from "@/features/targets/terminal/socket";

/** A stand-in for the browser's WebSocket that records what the page sends. */
class FakeSocket {
  static last: FakeSocket | undefined;
  static readonly OPEN = 1;
  binaryType = "blob";
  closed = false;
  readyState = 0;
  sent: (string | Uint8Array)[] = [];
  private readonly listeners = new Map<string, (event: unknown) => void>();
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, listener);
  }
  close() {
    this.closed = true;
  }
  message(data: ArrayBuffer | string) {
    this.listeners.get("message")?.({ data });
  }
  open() {
    this.readyState = 1;
    this.listeners.get("open")?.({});
  }
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  shut(code: number, reason = "") {
    this.readyState = 3;
    this.listeners.get("close")?.({ code, reason });
  }
}

const ticket = {
  expiresInSeconds: 30,
  sessionId: "s-1",
  ticket: "t/1+2",
  wsUrl: "wss://pam.example.org/proto/ssh/session",
};
const info = { hostname: "build1.example.org", pinned: true, username: "deploy" };
const at = (protocol: string, host: string) => sessionUrl(ticket, { host, protocol });
const unreachable = `couldn't reach the box's terminal service at ${globalThis.location.host}`;

const events = () => {
  const seen = { closed: [] as unknown[], opened: 0, output: [] as unknown[] };
  const handlers: SessionEvents = {
    onClose: (r) => seen.closed.push(r),
    onOpen: () => seen.opened++,
    onOutput: (d) => seen.output.push(d),
  };
  return { handlers, seen };
};

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the live SSH socket", () => {
  it("connects on the page's own origin, with the broker's path and the ticket", () => {
    expect(at("https:", "pam.example.org")).toBe(
      "wss://pam.example.org/proto/ssh/session?ticket=t%2F1%2B2",
    );
    // Opened by another name or an address than the broker's configured one: that one is used.
    expect(at("https:", "box.example.org")).toBe(
      "wss://box.example.org/proto/ssh/session?ticket=t%2F1%2B2",
    );
    expect(at("https:", "192.0.2.10")).toBe("wss://192.0.2.10/proto/ssh/session?ticket=t%2F1%2B2");
    expect(at("https:", "192.0.2.10:8443")).toBe(
      "wss://192.0.2.10:8443/proto/ssh/session?ticket=t%2F1%2B2",
    );
    expect(at("https:", "[2001:db8::1]")).toBe(
      "wss://[2001:db8::1]/proto/ssh/session?ticket=t%2F1%2B2",
    );
    expect(at("https:", "[2001:db8::1]:8443")).toBe(
      "wss://[2001:db8::1]:8443/proto/ssh/session?ticket=t%2F1%2B2",
    );
    expect(at("http:", "localhost:5176")).toBe(
      "ws://localhost:5176/proto/ssh/session?ticket=t%2F1%2B2",
    );
  });

  it("takes the page's origin from the browser's location by default", () => {
    expect(sessionUrl({ ...ticket, wsUrl: "wss://elsewhere.example.org/ssh/session" })).toBe(
      `ws://${globalThis.location.host}/ssh/session?ticket=t%2F1%2B2`,
    );
  });

  it("sends keystrokes as binary frames and a resize as a JSON text frame", async () => {
    const { handlers, seen } = events();
    const session = await openSocket(ticket, info, handlers);
    const ws = FakeSocket.last!;
    expect(ws.binaryType).toBe("arraybuffer");
    ws.open();
    expect(seen.opened).toBe(1);
    session.send("ls\r");
    session.resize(120, 40);
    expect(ws.sent[0]).toEqual(new TextEncoder().encode("ls\r"));
    expect(JSON.parse(ws.sent[1] as string)).toEqual({ cols: 120, rows: 40, type: "resize" });
    ws.message(new TextEncoder().encode("hi").buffer);
    expect(seen.output[0]).toEqual(new Uint8Array([104, 105]));
  });

  it("names the broker's host-key refusals", async () => {
    for (const [reason, kind] of [
      ["host key not pinned for this target", "host-key-not-pinned"],
      ["host key mismatch", "host-key-mismatch"],
    ]) {
      const { handlers, seen } = events();
      await openSocket(ticket, info, handlers);
      FakeSocket.last!.open();
      FakeSocket.last!.shut(1008, reason);
      expect(seen.closed).toEqual([{ kind }]);
    }
  });

  it("tells a session that never started from one that was cut off or ended", async () => {
    const never = events();
    await openSocket(ticket, info, never.handlers);
    FakeSocket.last!.shut(1006);
    expect(never.seen.closed).toEqual([{ detail: unreachable, kind: "failed", started: false }]);

    const cut = events();
    await openSocket(ticket, info, cut.handlers);
    FakeSocket.last!.open();
    FakeSocket.last!.shut(1006);
    expect(cut.seen.closed).toEqual([{ kind: "failed", started: true }]);

    const done = events();
    await openSocket(ticket, info, done.handlers);
    FakeSocket.last!.open();
    FakeSocket.last!.shut(1000);
    expect(done.seen.closed).toEqual([{ kind: "ended" }]);
  });

  it("carries the broker's reason when a session fails to start", async () => {
    const { handlers, seen } = events();
    await openSocket(ticket, info, handlers);
    FakeSocket.last!.shut(1011, "can't reach 192.0.2.10:22: connection timed out");
    expect(seen.closed).toEqual([
      { detail: "can't reach 192.0.2.10:22: connection timed out", kind: "failed", started: false },
    ]);
  });

  it("names the broker's reason even after the upgrade it refuses on", async () => {
    // The broker upgrades and then closes with the sentence, so the browser sees open first.
    const { handlers, seen } = events();
    await openSocket(ticket, info, handlers);
    FakeSocket.last!.open();
    FakeSocket.last!.shut(1011, "<host>:22 didn't finish the SSH handshake in 15s");
    expect(seen.closed).toEqual([
      {
        detail: "<host>:22 didn't finish the SSH handshake in 15s",
        kind: "failed",
        started: false,
      },
    ]);
  });

  it("waits longer than the broker's own open limit, so the broker's reason comes first", () => {
    expect(OPEN_TIMEOUT_MS).toBeGreaterThan(BROKER_OPEN_LIMIT_MS);
    expect(OPEN_TIMEOUT_MS).toBeLessThanOrEqual(BROKER_OPEN_LIMIT_MS + 10_000);
  });

  it("gives up on a socket that never opens", async () => {
    vi.useFakeTimers();
    try {
      const { handlers, seen } = events();
      await openSocket(ticket, info, handlers);
      vi.advanceTimersByTime(OPEN_TIMEOUT_MS - 1);
      expect(seen.closed).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.last!.closed).toBe(true);
      expect(seen.closed).toEqual([
        {
          detail: `${unreachable} in ${OPEN_TIMEOUT_MS / 1000} seconds`,
          kind: "failed",
          started: false,
        },
      ]);
      FakeSocket.last!.shut(1006);
      expect(seen.closed).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the open timer once the session opens", async () => {
    vi.useFakeTimers();
    try {
      const { handlers, seen } = events();
      await openSocket(ticket, info, handlers);
      FakeSocket.last!.open();
      vi.advanceTimersByTime(OPEN_TIMEOUT_MS * 2);
      expect(FakeSocket.last!.closed).toBe(false);
      expect(seen.closed).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a session address the browser refuses instead of throwing", async () => {
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor() {
          throw new DOMException("insecure", "SecurityError");
        }
      },
    );
    const { handlers, seen } = events();
    await openSocket(ticket, info, handlers);
    await Promise.resolve();
    expect(seen.closed).toEqual([
      {
        detail: "the browser refused the session address (SecurityError)",
        kind: "failed",
        started: false,
      },
    ]);
  });

  it("stays quiet when the page closes it", async () => {
    const { handlers, seen } = events();
    const session = await openSocket(ticket, info, handlers);
    FakeSocket.last!.open();
    session.close();
    FakeSocket.last!.shut(1000);
    expect(FakeSocket.last!.closed).toBe(true);
    expect(seen.closed).toEqual([]);
  });
});
