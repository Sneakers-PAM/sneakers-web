// @vitest-environment node
import { auth, GatewayClient, MeDocument } from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE } from "#mock/state";
import { appRequest, sessionCookie, withCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const client = (cookieHeader: string) =>
  new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader,
    sessionCookie: MOCK_SESSION_COOKIE,
  });

describe("mock-gateway testing helpers", () => {
  it("mint a signed-in session for a fixture user", async () => {
    const gw = client(sessionCookie("mock-user-alice"));
    const s = await auth.getSession(gw);
    expect(s).toMatchObject({
      authenticated: true,
      enrollmentRequired: false,
      userId: "mock-user-alice",
    });
    const me = await gw.gql(MeDocument, { id: "mock-user-alice" });
    expect(me.user?.name).toBe("Alice");
  });

  it("can mint the half session an account that must enrol gets", async () => {
    const s = await auth.getSession(
      client(sessionCookie("mock-user-dave", { mfaVerified: false })),
    );
    expect(s.enrollmentRequired).toBe(true);
  });

  it("add the cookie to a route's loader or action", async () => {
    const loader = withCookie(sessionCookie("mock-user-bob"), ({ request }) =>
      Promise.resolve(request.headers.get("Cookie")),
    );
    const seen = await loader({ context: {}, params: {}, request: appRequest("/") });
    expect(seen).toMatch(new RegExp(`^${MOCK_SESSION_COOKIE}=`));
  });

  it("throw for a user the fixtures don't have", () => {
    expect(() => sessionCookie("mock-user-nobody")).toThrow(/no fixture user/);
  });
});
