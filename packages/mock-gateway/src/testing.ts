import { setupServer } from "msw/node";

import { userById } from "#mock/fixtures/users";
import { handlers } from "#mock/handlers";
import { mintSession } from "#mock/handlers/auth";
import { MOCK_SESSION_COOKIE, resetMockState } from "#mock/state";

/*
 * Helpers for tests that run server code (loaders, actions) against the mock gateway. They use
 * Vitest's globals, so import them only from test files.
 */

/** The mock gateway, intercepting the server code's fetch calls for the tests in one file. */
export const server = setupServer(...handlers);

/** Start the mock gateway for this file, and reset its state after every test. */
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

/**
 * A Cookie header for a signed-in fixture user, without going through sign-in. By default the
 * session has passed its second factor; `mfaVerified: false` gives the half session an account
 * that must enrol gets.
 */
export const sessionCookie = (
  userId: string,
  { mfaVerified = true }: { mfaVerified?: boolean } = {},
): string => {
  if (!userById(userId)) throw new Error(`no fixture user ${userId}`);
  const { sid } = mintSession(userId, mfaVerified);
  return `${MOCK_SESSION_COOKIE}=${sid}`;
};

interface RouteArguments {
  context: unknown;
  params: Record<string, string | undefined>;
  request: Request;
}

/** Wrap a route's loader or action so every request it gets carries `cookie`. */
export const withCookie =
  <A extends RouteArguments, R>(cookie: string, run: (arguments_: A) => R) =>
  (arguments_: A): R => {
    const headers = new Headers(arguments_.request.headers);
    headers.set("Cookie", cookie);
    return run({ ...arguments_, request: new Request(arguments_.request, { headers }) });
  };
