import { http, HttpResponse } from "msw";

import { type MockUser, USERS, WRONG_CODE } from "#mock/fixtures/users";
import { MOCK_GATEWAY_URL, mockState, newToken } from "#mock/state";

/** The setup token a mock fresh install accepts, as if read from the server log. */
export const MOCK_SETUP_TOKEN = "mock-setup-token";

const at = (path: string) => `${MOCK_GATEWAY_URL}${path}`;
const fail = (status: number, error: string) => HttpResponse.json({ error } as never, { status });

const read = async <T>(request: Request): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
};

/** First-run setup and email verification, answered the way the gateway does. */
export const setupHandlers = [
  http.post(at("/setup/bootstrap"), async ({ request }) => {
    const body = await read<{
      email: string;
      name: string;
      password: string;
      setupToken: string;
      username: string;
    }>(request);
    if (body.setupToken?.trim() !== MOCK_SETUP_TOKEN) return fail(403, "invalid setup token");
    if (!mockState.needsSetup) return fail(409, "already set up");
    if (!body.username?.trim() || !body.email?.trim() || !body.password)
      return fail(400, "username, email, and password are required");
    const user: MockUser = {
      disabled: false,
      email: body.email.trim().toLowerCase(),
      emailVerified: false,
      factors: [],
      id: newToken("mock-user"),
      isRoot: true,
      name: body.name?.trim() || body.username.trim(),
      roles: ["site-admin"],
      username: body.username.trim().toLowerCase(),
    };
    USERS.push(user);
    mockState.needsSetup = false;
    return HttpResponse.json({ userId: user.id });
  }),

  http.post(at("/setup/seed"), async ({ request }) => {
    const body = await read<{ setupToken: string; userId: string }>(request);
    if (body.setupToken?.trim() !== MOCK_SETUP_TOKEN) return fail(403, "invalid setup token");
    if (!body.userId?.trim())
      return fail(400, "userId is required: pass the id /setup/bootstrap returned");
    const w = mockState.world;
    return HttpResponse.json({
      connections: w.connections.length,
      folders: w.folders.length,
      types: w.secretTypes.length,
    });
  }),

  http.post(at("/auth/verify/request"), async ({ request }) => {
    const body = await read<{ userId: string }>(request);
    return body.userId ? HttpResponse.json({ status: "ok" }) : fail(400, "invalid_request");
  }),

  http.post(at("/auth/verify/confirm"), async ({ request }) => {
    const body = await read<{ code: string; email: string; userId: string }>(request);
    const user = USERS.find((u) => u.id === body.userId || (body.email && u.email === body.email));
    if (!body.code || !user) return fail(400, "invalid_request");
    if (body.code === WRONG_CODE || !/^\d{6}$/.test(body.code)) return fail(400, "invalid_code");
    user.emailVerified = true;
    return HttpResponse.json({ status: "ok" });
  }),
];
