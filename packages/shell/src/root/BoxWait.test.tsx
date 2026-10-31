import { MARK_BODY } from "@sneakers-web/ui";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { BoxWait } from "#shell/root/BoxWait";

const boxState = (state: string) => Response.json({ state }, { status: 200 });

const renderWait = () => {
  const Stub = createRoutesStub([
    { Component: () => <BoxWait>the real error</BoxWait>, path: "/" },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

/** The mark is decorative, so it has no role or name to query. */
const markDrawn = () =>
  // eslint-disable-next-line testing-library/no-node-access -- see above.
  [...document.querySelectorAll("svg path")].some((path) => path.getAttribute("d") === MARK_BODY);

describe("BoxWait's mark", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the mark while it's still asking, before the box answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderWait();
    expect(await screen.findByText("Checking Sneakers-PAM…")).toBeInTheDocument();
    expect(markDrawn()).toBe(true);
  });

  it.each([
    ["starting", "Sneakers-PAM is starting"],
    ["updating", "Sneakers-PAM is updating"],
    ["maintenance", "Sneakers-PAM is in maintenance"],
    ["rebooting", "Sneakers-PAM is rebooting"],
    ["shutting-down", "Sneakers-PAM is shutting down"],
    ["failed", "Sneakers-PAM failed to start"],
  ])("draws the mark while the box is %s", async (state, title) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(boxState(state)));
    renderWait();
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(markDrawn()).toBe(true);
  });

  it("draws the mark with no request for it when nothing answers", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    renderWait();
    expect(await screen.findByText("Sneakers-PAM can't be reached")).toBeInTheDocument();
    expect(markDrawn()).toBe(true);
    const asked = fetchMock.mock.calls.map(([url]) => String(url));
    expect(asked.every((url) => url === "/_box/state")).toBe(true);
  });
});
