import type { Connect } from "@/features/targets/terminal/session";

import { openSocket } from "@/features/targets/terminal/socket";

/**
 * How the page reaches the shell: the broker's WebSocket, or in a mock build the pretend shell.
 * The flag is replaced at build time, so a live bundle keeps only the socket.
 */
export const connectSession: Connect = async (ticket, info, events) => {
  if (import.meta.env.SNEAKERS_MOCK === "true") {
    const { openMockShell } = await import("@/features/targets/terminal/mockShell");
    return openMockShell(ticket, info, events);
  }
  return openSocket(ticket, info, events);
};
