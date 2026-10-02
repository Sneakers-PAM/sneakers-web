import { createLogger } from "@sneakers-web/api-client";
import { storageKey } from "@sneakers-web/api-client";
import { edge } from "@sneakers-web/edge";
import { applyDisplay, parseDisplay } from "@sneakers-web/ui";
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";

const log = createLogger("boot");

/**
 * Start an app: apply the saved display settings before first paint, start the network
 * edge this build was made with, then render.
 */
export const boot = async (app: ReactNode): Promise<void> => {
  applyDisplay(parseDisplay(localStorage.getItem(storageKey("display"))));
  log.info("starting", { edge: edge.mode, version: __APP_VERSION__ });
  await edge.start();
  const root = document.querySelector("#root");
  if (!root) throw new Error("The page has no #root element");
  createRoot(root).render(<StrictMode>{app}</StrictMode>);
};
