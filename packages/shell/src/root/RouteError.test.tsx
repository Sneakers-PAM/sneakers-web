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

describe("RouteError's box check", () => {
  beforeEach(() => {
    (globalThis as { __sneakersBox?: boolean }).__sneakersBox = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { __sneakersBox?: boolean }).__sneakersBox;
    vi.unstubAllGlobals();
  });

  it("stops asking the box once it says it's running", async () => {
    const fetchMock = vi.fn().mockResolvedValue(boxState("running"));
    vi.stubGlobal("fetch", fetchMock);
    renderFailing(new Error("boom"));
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits for a slow answer, one ask at a time", async () => {
    let inFlight = 0;
    let most = 0;
    let aborted = 0;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      inFlight++;
      most = Math.max(most, inFlight);
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          inFlight--;
          resolve(boxState("updating"));
        }, 2500);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          inFlight--;
          aborted++;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderFailing(new TypeError("Failed to fetch"));
    expect(await screen.findByText("Checking Sneakers-PAM…")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await screen.findByText("Sneakers-PAM is updating")).toBeInTheDocument();
    expect(aborted).toBe(0);
    expect(most).toBe(1);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
  });

  it("doesn't ask while the tab is hidden, and asks at once when it's shown", async () => {
    const fetchMock = vi.fn().mockResolvedValue(boxState("updating"));
    vi.stubGlobal("fetch", fetchMock);
    renderFailing(new TypeError("Failed to fetch"));
    expect(await screen.findByText("Sneakers-PAM is updating")).toBeInTheDocument();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(2000);
    const before = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(before);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
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
