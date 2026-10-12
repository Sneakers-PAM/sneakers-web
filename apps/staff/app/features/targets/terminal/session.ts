import type { SessionTicket } from "@/features/targets/terminal.server";

/**
 * Why a session ended: the shell closed, the broker refused the host's key, or it failed.
 * `detail` is the broker's sentence for a session that couldn't start (the step and the reason).
 */
export type CloseReason =
  | { detail?: string; kind: "failed"; started: boolean }
  | { kind: "ended" }
  | { kind: "host-key-mismatch" }
  | { kind: "host-key-not-pinned" };

export type Connect = (
  ticket: SessionTicket,
  info: SessionInfo,
  events: SessionEvents,
) => Promise<Session>;

/** One open SSH session. `close` from the page ends it without an onClose. */
export interface Session {
  close: () => void;
  resize: (cols: number, rows: number) => void;
  send: (input: string) => void;
}

export interface SessionEvents {
  onClose: (reason: CloseReason) => void;
  onOpen: () => void;
  onOutput: (data: string | Uint8Array) => void;
}

/** Who the session is for, from the page's loader. */
export interface SessionInfo {
  hostname: string;
  pinned: boolean;
  username: string;
}
