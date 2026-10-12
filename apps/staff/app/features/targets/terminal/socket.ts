import type { SessionTicket } from "@/features/targets/terminal.server";
import type { CloseReason, Connect } from "@/features/targets/terminal/session";

// The broker closes with 1008 (policy violation) and one of these reasons when the host's key
// isn't pinned or doesn't match; a browser can't read the body of a failed handshake.
const POLICY_VIOLATION = 1008;
const NORMAL_CLOSE = 1000;
// The broker closes with 1011 and a sentence naming the step and the reason when an open fails.
const OPEN_FAILED = 1011;

/**
 * How long the page waits for the socket to open. The broker bounds its whole open at 45 s and
 * then says why; this only catches a socket nothing answers, such as one an edge holds.
 */
export const OPEN_TIMEOUT_MS = 60_000;
const NOT_PINNED = "host key not pinned for this target";
const MISMATCH = "host key mismatch";

/** The broker's WebSocket URL as the gateway gave it, with the ticket appended. */
export const sessionUrl = (ticket: SessionTicket): string => {
  const url = new URL(ticket.wsUrl);
  url.searchParams.set("ticket", ticket.ticket);
  return url.toString();
};

const closeReason = (code: number, reason: string, started: boolean): CloseReason => {
  if (code === POLICY_VIOLATION && reason === NOT_PINNED) return { kind: "host-key-not-pinned" };
  if (code === POLICY_VIOLATION && reason === MISMATCH) return { kind: "host-key-mismatch" };
  if (code === NORMAL_CLOSE && started) return { kind: "ended" };
  if (code === OPEN_FAILED && !started && reason)
    return { detail: reason, kind: "failed", started };
  return { kind: "failed", started };
};

/**
 * A live session over the SSH broker's WebSocket PTY endpoint: keystrokes go as binary frames
 * (the broker drops text frames other than a resize), output comes back as binary.
 */
export const openSocket: Connect = (ticket, _info, events) => {
  let ws: WebSocket;
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
      detail: `the SSH broker didn't answer in ${OPEN_TIMEOUT_MS / 1000} seconds`,
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
    finish(closeReason(event.code, event.reason, started));
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
