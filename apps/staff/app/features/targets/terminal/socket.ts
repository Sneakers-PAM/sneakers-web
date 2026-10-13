import type { SessionTicket } from "@/features/targets/terminal.server";
import type { CloseReason, Connect } from "@/features/targets/terminal/session";

// The broker closes with 1008 (policy violation) and one of these reasons when the host's key
// isn't pinned or doesn't match; a browser can't read the body of a failed handshake.
const POLICY_VIOLATION = 1008;
const NORMAL_CLOSE = 1000;
// The broker closes with 1011 and a sentence naming the step and the reason when an open fails.
const OPEN_FAILED = 1011;

/**
 * The broker's own bound on a whole open (the key reveal, the dial, the SSH handshake and the
 * shell), after which it closes with the step that stalled. It answers the upgrade only once the
 * shell is up, so the page can't tell a slow target from a box it never reached any sooner.
 */
export const BROKER_OPEN_LIMIT_MS = 45_000;

/**
 * How long the page waits for the socket to open: just past the broker's own limit, so the
 * broker's reason always comes first. It catches a socket nothing answers, such as an address
 * that drops the connection or an edge that holds it. A box that refuses or can't be found ends
 * the socket at once instead, and is reported straight away.
 */
export const OPEN_TIMEOUT_MS = BROKER_OPEN_LIMIT_MS + 5000;
const NOT_PINNED = "host key not pinned for this target";
const MISMATCH = "host key mismatch";

/** Where the page was loaded from: the browser's location, or a test's. */
export type PageOrigin = Pick<Location, "host" | "protocol">;

/**
 * The broker's WebSocket on the page's own origin: the path the gateway gave, on the host the
 * page was loaded from (a name, an IPv4 address or a bracketed IPv6 address, with its port), with
 * the ticket appended. The configured URL's host is not used, so a box opened by an address its
 * name doesn't resolve to still reaches its broker, and the browser's connect-src 'self' allows it.
 */
export const sessionUrl = (
  ticket: SessionTicket,
  page: PageOrigin = globalThis.location,
): string => {
  const scheme = page.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${scheme}//${page.host}${new URL(ticket.wsUrl, "ws://broker").pathname}`);
  url.searchParams.set("ticket", ticket.ticket);
  return url.toString();
};

/** The sentence for a socket that never reached the broker, naming the address it tried. */
const unreachable = (host: string) => `couldn't reach the box's terminal service at ${host}`;

const closeReason = (code: number, reason: string, started: boolean, host: string): CloseReason => {
  if (code === POLICY_VIOLATION && reason === NOT_PINNED) return { kind: "host-key-not-pinned" };
  if (code === POLICY_VIOLATION && reason === MISMATCH) return { kind: "host-key-mismatch" };
  if (code === NORMAL_CLOSE && started) return { kind: "ended" };
  // The broker sends 1011 only for an open that failed, right after the upgrade it refuses on.
  if (code === OPEN_FAILED && reason) return { detail: reason, kind: "failed", started: false };
  if (!started) return { detail: unreachable(host), kind: "failed", started };
  return { kind: "failed", started };
};

/**
 * A live session over the SSH broker's WebSocket PTY endpoint: keystrokes go as binary frames
 * (the broker drops text frames other than a resize), output comes back as binary.
 */
export const openSocket: Connect = (ticket, _info, events) => {
  let ws: WebSocket;
  const host = globalThis.location.host;
  try {
    ws = new WebSocket(sessionUrl(ticket));
  } catch (error) {
    // A URL the browser won't open (malformed, or ws: from an https page) throws here rather
    // than closing, so it's reported the same way a close would be.
    const name = (error as { name?: unknown } | null)?.name;
    queueMicrotask(() =>
      events.onClose({
        detail: `the browser refused the session address (${typeof name === "string" ? name : "Error"})`,
        kind: "failed",
        started: false,
      }),
    );
    return Promise.resolve({ close: () => {}, resize: () => {}, send: () => {} });
  }
  ws.binaryType = "arraybuffer";
  let started = false;
  let done = false;
  const encoder = new TextEncoder();
  const live = () => ws.readyState === WebSocket.OPEN;
  const finish = (reason: CloseReason) => {
    clearTimeout(timer);
    if (done) return;
    done = true;
    events.onClose(reason);
  };
  const timer = setTimeout(() => {
    ws.close();
    finish({
      detail: `${unreachable(host)} in ${OPEN_TIMEOUT_MS / 1000} seconds`,
      kind: "failed",
      started: false,
    });
  }, OPEN_TIMEOUT_MS);
  ws.addEventListener("open", () => {
    clearTimeout(timer);
    started = true;
    events.onOpen();
  });
  ws.addEventListener("message", (event: MessageEvent<ArrayBuffer | string>) => {
    events.onOutput(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
  });
  ws.addEventListener("close", (event: CloseEvent) => {
    finish(closeReason(event.code, event.reason, started, host));
  });
  return Promise.resolve({
    close: () => {
      clearTimeout(timer);
      done = true;
      ws.close();
    },
    resize: (cols, rows) => {
      if (live()) ws.send(JSON.stringify({ cols, rows, type: "resize" }));
    },
    send: (input) => {
      if (live()) ws.send(encoder.encode(input));
    },
  });
};
