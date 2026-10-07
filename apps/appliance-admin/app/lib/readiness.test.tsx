import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { createRoutesStub, Outlet } from "react-router";

import { trackRequest, useReadyMarker } from "@/lib/readiness";

const Root = () => {
  useReadyMarker();
  return <Outlet />;
};

const ready = () => document.documentElement.dataset.appReady;

describe("useReadyMarker", () => {
  afterEach(() => {
    delete document.documentElement.dataset.appReady;
  });

  it("marks the page ready only once the route's requests have answered", async () => {
    let answer!: () => void;
    const Page = () => {
      useEffect(() => {
        void trackRequest(new Promise<void>((resolve) => (answer = resolve)));
      }, []);
      return <p>page</p>;
    };
    const Stub = createRoutesStub([
      { children: [{ Component: Page, path: "/status" }], Component: Root, path: "/" },
    ]);
    render(<Stub initialEntries={["/status"]} />);
    await act(async () => {});
    expect(ready()).toBeUndefined();

    await act(async () => answer());
    expect(ready()).toBe("/status");
  });

  it("counts a failed request as answered", async () => {
    const Page = () => {
      useEffect(() => {
        trackRequest(Promise.reject(new Error("down"))).catch(() => {});
      }, []);
      return <p>page</p>;
    };
    const Stub = createRoutesStub([
      { children: [{ Component: Page, path: "/logs" }], Component: Root, path: "/" },
    ]);
    render(<Stub initialEntries={["/logs"]} />);
    await act(async () => {});
    expect(ready()).toBe("/logs");
  });
});
