import { createContext } from "react";

import type { CreateScreen } from "@/features/targets/terminal/screen";
import type { Connect } from "@/features/targets/terminal/session";

import { createXtermScreen } from "@/features/targets/terminal/screen";
import { connectSession } from "@/features/targets/terminal/transport";

export interface TerminalDeps {
  connect: Connect;
  createScreen: CreateScreen;
}

/** The screen and the connection the terminal uses; tests swap in their own. */
export const TerminalDepsContext = createContext<TerminalDeps>({
  connect: connectSession,
  createScreen: createXtermScreen,
});
