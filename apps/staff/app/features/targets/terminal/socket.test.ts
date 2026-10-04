import type { SessionEvents } from "@/features/targets/terminal/session";

import { openSocket, sessionUrl } from "@/features/targets/terminal/socket";

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
  it("connects to the broker's URL as given, with the ticket as a query parameter", () => {
    expect(sessionUrl(ticket)).toBe("wss://pam.example.org/proto/ssh/session?ticket=t%2F1%2B2");
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
    expect(never.seen.closed).toEqual([{ kind: "failed", started: false }]);

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
