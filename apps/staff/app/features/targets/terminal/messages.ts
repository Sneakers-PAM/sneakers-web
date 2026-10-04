import type { CloseReason } from "@/features/targets/terminal/session";

/** What the error card says when a session ends badly. The key is never shown either way. */
export const closeMessage = (reason: Exclude<CloseReason, { kind: "ended" }>): string => {
  switch (reason.kind) {
    case "failed": {
      return reason.started
        ? "The SSH session was interrupted. The key was not shown to anyone."
        : "The SSH session couldn't start: the ticket ran out, or the host didn't answer. The key was not shown to anyone.";
    }
    case "host-key-mismatch": {
      return "The host offered an SSH key that isn't pinned for this target, so the broker didn't connect. Ask an admin to check the host before trying again.";
    }
    case "host-key-not-pinned": {
      return "This host has no pinned SSH host key, so the broker won't connect to it. An admin can pin its key on the target.";
    }
  }
};
