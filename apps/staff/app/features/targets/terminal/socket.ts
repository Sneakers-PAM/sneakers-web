import type { SessionTicket } from "@/features/targets/terminal.server";
import type { CloseReason, Connect } from "@/features/targets/terminal/session";

// The broker closes with 1008 (policy violation) and one of these reasons when the host's key
// isn't pinned or doesn't match; a browser can't read the body of a failed handshake.
const POLICY_VIOLATION = 1008;
const NORMAL_CLOSE = 1000;
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
  return { kind: "failed", started };
};

/**
 * A live session over the SSH broker's WebSocket PTY endpoint: keystrokes go as binary frames
 * (the broker drops text frames other than a resize), output comes back as binary.
 */
export const openSocket: Connect = (ticket, _info, events) => {
  const ws = new WebSocket(sessionUrl(ticket));
  ws.binaryType = "arraybuffer";
  let started = false;
  let done = false;
  const encoder = new TextEncoder();
  const live = () => ws.readyState === WebSocket.OPEN;
  ws.addEventListener("open", () => {
    started = true;
    events.onOpen();
  });
  ws.addEventListener("message", (event: MessageEvent<ArrayBuffer | string>) => {
    events.onOutput(typeof event.data === "string" ? event.data : new Uint8Array(event.data));
  });
  ws.addEventListener("close", (event: CloseEvent) => {
    if (done) return;
    done = true;
    events.onClose(closeReason(event.code, event.reason, started));
  });
  return Promise.resolve({
    close: () => {
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
