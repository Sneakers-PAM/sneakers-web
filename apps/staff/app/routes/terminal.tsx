import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import xtermCss from "@xterm/xterm/css/xterm.css?url";

import {
  loadTerminal,
  terminalAction,
  type TerminalData,
} from "@/features/targets/terminal.server";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadTerminal(request, params.id ?? "");

/** `open`: a fresh single-use session ticket. The page connects with it straight away. */
export const action = ({ params, request }: ActionFunctionArgs) =>
  terminalAction(request, params.id ?? "");

export const links = () => [{ href: xtermCss, rel: "stylesheet" }];

export const meta = ({ data }: { data?: TerminalData }) => [
  { title: `${data ? `${data.secret.name} · ` : ""}Terminal · Sneakers-PAM` },
];

export {
  TerminalPage as default,
  TerminalError as ErrorBoundary,
} from "@/features/targets/terminal/TerminalPage";
