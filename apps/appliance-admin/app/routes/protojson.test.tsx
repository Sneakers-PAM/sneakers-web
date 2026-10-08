import type { ComponentType } from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub, Outlet, useRouteError } from "react-router";

import { useReadyMarker } from "@/lib/readiness";
import { edge } from "@/mock/edge.mock";
import { ErrorBoundary, clientLoader as rootLoader } from "@/root";
import routes from "@/routes";
import { asProtojson, emptyLists } from "@/test/protojson";
import { signInAs } from "@/test/session";

interface RouteEntry {
  children?: RouteEntry[];
  file: string;
  index?: boolean;
  path?: string;
}

interface RouteModule {
  clientLoader?: () => unknown;
  default: ComponentType;
}

const modules = import.meta.glob<RouteModule>(["./*.tsx", "!./*.test.tsx"], { eager: true });
const moduleOf = (file: string): RouteModule => {
  const found = modules[`./${file.replace(/^routes\//, "")}`];
  if (!found) throw new Error(`no route module ${file}`);
  return found;
};

/** The app's own route config, as stub routes, so a new route is covered by itself. */
const stubRoutes = (entries: RouteEntry[]): Parameters<typeof createRoutesStub>[0] =>
  entries.map(({ children: nested, file, index, path }) => {
    const route = moduleOf(file);
    return {
      children: nested ? stubRoutes(nested) : undefined,
      Component: route.default,
      index,
      loader: route.clientLoader,
      path,
    };
  }) as Parameters<typeof createRoutesStub>[0];

/** The pages a visitor can open, one per route in the config. */
const pagePaths = (entries: RouteEntry[]): string[] =>
  entries.flatMap(({ children: nested, index, path }) => {
    if (nested) return pagePaths(nested);
    if (index) return ["/"];
    return [path === "*" ? "/no-such-page" : `/${path ?? ""}`];
  });

const Root = () => {
  useReadyMarker();
  return <Outlet />;
};

/** A thrown Error is a crash; a route error response (a 404) goes to the app's own boundary. */
const CrashOrBoundary = () => {
  const error = useRouteError();
  if (error instanceof Error) return <p>Crashed: {`${error.name}: ${error.message}`}</p>;
  return <ErrorBoundary />;
};

const renderAt = (path: string) => {
  const Stub = createRoutesStub([
    {
      children: stubRoutes(routes as RouteEntry[]),
      Component: Root,
      ErrorBoundary: CrashOrBoundary,
      id: "root",
      loader: rootLoader,
    },
  ]);
  return render(<Stub initialEntries={[path]} />);
};

const SHAPES = [
  { name: "the fixture data", shape: (answer: unknown) => asProtojson(answer) },
  {
    name: "the lists inside list items empty (an admin with no keys)",
    shape: (answer: unknown) => asProtojson(emptyLists(answer, 1)),
  },
  { name: "every list empty", shape: (answer: unknown) => asProtojson(emptyLists(answer, 0)) },
];

let calls = 0;

/**
 * Settled: the ready marker is on and no new call started over a few macrotasks. The marker
 * alone can flash on between the frame's call answering and the page's first call starting.
 */
const settled = async (path: string) => {
  for (;;) {
    await waitFor(
      () => {
        const crash = screen.queryByText(/^Crashed:/);
        if (crash) throw new Error(`${path}: ${crash.textContent ?? ""}`);
        expect(document.documentElement.dataset.appReady).toBeDefined();
      },
      { timeout: 4000 },
    );
    const before = calls;
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    if (calls === before && document.documentElement.dataset.appReady !== undefined) return;
  }
};

describe.each(SHAPES)("every page against protojson answers: $name", ({ shape }) => {
  beforeEach(() => {
    calls = 0;
    const request = edge.request.bind(edge);
    vi.spyOn(edge, "request").mockImplementation(async (service, method, body) => {
      calls++;
      return shape(await request(service, method, body)) as never;
    });
    signInAs("alice");
  });

  it.each(pagePaths(routes as RouteEntry[]))("%s renders without crashing", async (path) => {
    renderAt(path);
    await settled(path);
    expect(screen.queryByText(/^Crashed:/)).toBeNull();
  });
});
