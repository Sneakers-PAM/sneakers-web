import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { useBreakpoint, useMediaQuery } from "#ui/lib/media";

const Probe = () => (
  <p>
    {useBreakpoint()} {String(useMediaQuery("(min-width: 1024px)"))}
  </p>
);

const desktopScreen = () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => ({
    addEventListener: () => {},
    matches: /min-width: (600|1024)px/.test(query),
    media: query,
    removeEventListener: () => {},
  })) as unknown as typeof matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

describe("useBreakpoint and useMediaQuery", () => {
  it("hydrate a server render on a desktop screen without a mismatch, then follow the screen", async () => {
    // The server has no screen, so it renders the default.
    const view = renderToString(<Probe />);
    const restore = desktopScreen();
    const container = document.createElement("div");
    container.innerHTML = view;
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError: recoverable });
    });
    restore();
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.textContent).toBe("desktop true");
  });
});
