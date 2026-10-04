import type { SessionTicket } from "@/features/targets/terminal.server";

/** Why a session ended: the shell closed, the broker refused the host's key, or it failed. */
export type CloseReason =
  | { kind: "ended" }
  | { kind: "failed"; started: boolean }
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
