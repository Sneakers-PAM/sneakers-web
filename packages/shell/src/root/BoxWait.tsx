import { Spinner } from "@sneakers-web/ui";
import { type ReactNode, useEffect, useState } from "react";

import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";
import { BOX_STATE_HEADER } from "#shell/root/boxState";

const POLL_MS = 1000;
const TIMEOUT_MS = 1500;

/** The words the appliance's box-state page uses, so the two read the same. */
const WORDS: Record<string, [string, string]> = {
  maintenance: [
    "Sneakers-PAM is in maintenance",
    "It comes back when the maintenance is over. This page reloads when it's ready.",
  ],
  rebooting: [
    "Sneakers-PAM is rebooting",
    "It comes back by itself. This page reloads when it's ready.",
  ],
  "shutting-down": [
    "Sneakers-PAM is shutting down",
    "It powers off by itself. Power it on again to use it.",
  ],
  starting: ["Sneakers-PAM is starting", "This page reloads by itself when it's ready."],
  updating: [
    "Sneakers-PAM is updating",
    "It comes back by itself when the update is done. This page reloads when it's ready.",
  ],
};
const UNREACHABLE: [string, string] = [
  "Sneakers-PAM can't be reached",
  "If the box is restarting it comes back by itself. This page reloads when it's back.",
];

/** Whether this page runs on the appliance: its box-state poller has loaded. */
export const onAppliance = (): boolean =>
  (globalThis as { __sneakersBox?: boolean }).__sneakersBox === true;

const ask = async (url: string, method: string): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      method,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const readState = async (): Promise<string> => {
  const response = await ask("/_box/state", "GET");
  if (!response.ok) throw new Error(`state ${response.status}`);
  const body = (await response.json()) as { state?: unknown };
  return typeof body.state === "string" ? body.state : "";
};

/** "checking", "running", "unreachable" or the box state seen. */
type Seen = string;

/**
 * On the appliance an error screen first asks the box what it's doing. While the box starts,
 * updates or can't be reached, the page says so in the box-state page's words instead of a
 * generic error, asks every second, and reloads once the box runs and the page itself answers
 * (not with the box-state page). When the box runs, the real error shows.
 */
export const BoxWait = ({ children }: { children: ReactNode }) => {
  const [seen, setSeen] = useState<Seen>("checking");
  useEffect(() => {
    let live = true;
    let waited = false;
    let reloading = false;
    const tick = async () => {
      let state: string;
      try {
        state = await readState();
      } catch {
        waited = true;
        if (live) setSeen("unreachable");
        return;
      }
      if (!live) return;
      if (state !== "running") {
        waited = true;
        setSeen(state || "starting");
        return;
      }
      if (!waited) {
        setSeen("running");
        return;
      }
      try {
        const page = await ask(globalThis.location.href, "HEAD");
        if (page.ok && !page.headers.get(BOX_STATE_HEADER) && !reloading) {
          reloading = true;
          globalThis.location.reload();
        }
      } catch {
        // Not back yet; the next tick asks again.
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (seen === "running") return <>{children}</>;
  if (seen === "checking") {
    return (
      <CenteredFrame>
        <div className="flex items-center gap-3 text-[1.0625rem] font-bold" role="status">
          <Spinner />
          Checking Sneakers-PAM…
        </div>
      </CenteredFrame>
    );
  }
  const [title, body] = seen === "unreachable" ? UNREACHABLE : (WORDS[seen] ?? WORDS.starting!);
  return (
    <CenteredFrame>
      <div aria-live="polite" className="flex flex-col gap-4" role="status">
        <FrameTitle body={body} title={title} />
        <Spinner />
      </div>
    </CenteredFrame>
  );
};
