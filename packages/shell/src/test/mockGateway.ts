import { handlers, resetMockState } from "@sneakers-web/mock-gateway";
import { setupServer } from "msw/node";

/** The mock gateway, intercepting the server code's fetch calls for the tests in one file. */
export const server = setupServer(...handlers);

export const withMockGateway = (): void => {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => {
    server.resetHandlers();
    resetMockState();
  });
  afterAll(() => server.close());
};

/** A request as the browser would send it to the app server. */
export const appRequest = (path: string, init: { cookie?: string } & RequestInit = {}): Request => {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);
  return new Request(new URL(path, "https://app.example.invalid"), { ...init, headers });
};

export const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

/** The session cookie the mock gateway set, as a Cookie header for the next request. */
export const cookieFrom = (headers: Headers): string =>
  headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
