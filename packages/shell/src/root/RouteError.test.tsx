import { render, screen } from "@testing-library/react";
import { createRoutesStub, data } from "react-router";

import { RouteError } from "#shell/root/RouteError";

const boxState = (state: string) =>
  Response.json({ state }, { headers: { "Cache-Control": "no-store" }, status: 200 });

const renderFailing = (thrown: unknown) => {
  const Stub = createRoutesStub([
    {
      Component: () => <p>secret page</p>,
      ErrorBoundary: RouteError,
      HydrateFallback: () => null,
      id: "root",
      loader: () => {
        throw thrown;
      },
      path: "/",
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

describe("RouteError on the appliance", () => {
  beforeEach(() => {
    (globalThis as { __sneakersBox?: boolean }).__sneakersBox = true;
  });
  afterEach(() => {
    delete (globalThis as { __sneakersBox?: boolean }).__sneakersBox;
    vi.unstubAllGlobals();
  });

  it("says the box is updating, not that the page broke, while the box isn't running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(boxState("updating")));
    renderFailing(new TypeError("Failed to fetch"));
    expect(await screen.findByText("Sneakers-PAM is updating")).toBeInTheDocument();
    expect(screen.queryByText("Something broke")).not.toBeInTheDocument();
  });

  it("says the box is starting for a request the edge held", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(boxState("starting")));
    renderFailing(data("held", { status: 503 }));
    expect(await screen.findByText("Sneakers-PAM is starting")).toBeInTheDocument();
    expect(screen.queryByText("Can't reach the server")).not.toBeInTheDocument();
  });

  it("waits for the box while nothing answers, then reloads once it's back", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...globalThis.location, reload });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(boxState("running"))
      .mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderFailing(new TypeError("Failed to fetch"));
    expect(await screen.findByText("Sneakers-PAM can't be reached")).toBeInTheDocument();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 4000 });
  });

  it("shows the real error when the box is running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(boxState("running")));
    renderFailing(new Error("boom"));
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
  });
});

describe("RouteError off the appliance", () => {
  it("shows the crash screen without asking the box", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderFailing(new Error("boom"));
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
