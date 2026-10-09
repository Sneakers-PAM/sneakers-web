/* eslint-disable testing-library/no-container, testing-library/no-node-access -- a script tag has no accessible role to query. */
import { DEFAULT_DISPLAY } from "@sneakers-web/ui";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { BoxPoller } from "#shell/root/Document";

const page = (boxPoller: boolean) =>
  createRoutesStub([
    {
      Component: () => (
        <>
          <BoxPoller />
          <p>loaded</p>
        </>
      ),
      HydrateFallback: () => null,
      id: "root",
      loader: () => ({ boxPoller, display: DEFAULT_DISPLAY }),
      path: "/",
    },
  ]);

describe("the appliance box-state poller tag", () => {
  it("loads /_box/poll.js, deferred, when the app runs on the appliance", async () => {
    const Stub = page(true);
    const { container } = render(<Stub initialEntries={["/"]} />);
    await screen.findByText("loaded");
    const scripts = container.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("src", "/_box/poll.js");
    expect(scripts[0]).toHaveAttribute("defer");
  });

  it("is absent everywhere else", async () => {
    const Stub = page(false);
    const { container } = render(<Stub initialEntries={["/"]} />);
    await screen.findByText("loaded");
    expect(container.querySelector("script")).toBeNull();
  });
});
