import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Server-side tests run in plain Node (no DOM); everything below is for the jsdom ones.
const dom = typeof document !== "undefined";

if (dom) {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  if (!globalThis.matchMedia) {
    Object.defineProperty(globalThis, "matchMedia", {
      value: (query: string) => ({
        addEventListener: () => {},
        addListener: () => {},
        dispatchEvent: () => false,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
        removeListener: () => {},
      }),
      writable: true,
    });
  }

  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: ResizeObserverStub,
      writable: true,
    });
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  }
}
