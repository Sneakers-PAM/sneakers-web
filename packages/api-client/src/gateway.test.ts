import { ApiError, GatewayUnreachableError, GraphQLRequestError } from "#api/errors";
import { GatewayClient, readCookie } from "#api/gateway";
import { MeDocument, UnreadCountDocument } from "#api/generated/graphql";

type Call = { headers: Record<string, string>; url: string };

const fakeFetch = (answer: (url: string) => Response) => {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ headers: (init?.headers ?? {}) as Record<string, string>, url });
    return answer(url);
  }) as typeof fetch;
  return { calls, fetcher };
};

describe("GatewayClient", () => {
  it("forwards only the session cookie, never the browser's other cookies", async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json({ authenticated: false }));
    const gw = new GatewayClient({
      baseUrl: "https://gateway.example.invalid",
      cookieHeader: "theme=dark; sneakers_sid=abc%3D1; tracker=xyz",
      fetch: fetcher,
      sessionCookie: "sneakers_sid",
    });
    await gw.request("/auth/session");
    expect(calls[0]?.headers.Cookie).toBe("sneakers_sid=abc%3D1");
    expect(calls[0]?.url).toBe("https://gateway.example.invalid/auth/session");
  });

  it("sends the CSRF token on GraphQL calls and collects Set-Cookie for the browser", async () => {
    const { calls, fetcher } = fakeFetch(() =>
      Response.json(
        { data: { myUnreadNotificationCount: 2 } },
        {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "sneakers_sid=new; Path=/; HttpOnly",
          },
        },
      ),
    );
    const gw = new GatewayClient({
      baseUrl: "https://g.example.invalid",
      cookieHeader: null,
      fetch: fetcher,
      sessionCookie: "sneakers_sid",
    });
    gw.setCsrf("csrf-1");
    const d = await gw.gql(UnreadCountDocument);
    expect(d.myUnreadNotificationCount).toBe(2);
    expect(calls[0]?.headers["X-CSRF-Token"]).toBe("csrf-1");
    expect(gw.setCookies).toEqual(["sneakers_sid=new; Path=/; HttpOnly"]);
    expect(gw.hasSessionCookie).toBe(true);
  });

  it("turns GraphQL errors into a typed refusal", async () => {
    const { fetcher } = fakeFetch(() =>
      Response.json({
        errors: [
          { extensions: { code: "NOT_FOUND" }, message: "rpc error: code = NotFound desc = x" },
        ],
      }),
    );
    const gw = new GatewayClient({
      baseUrl: "https://g.example.invalid",
      cookieHeader: null,
      fetch: fetcher,
      sessionCookie: "s",
    });
    await expect(gw.gql(MeDocument, { id: "mock-user-x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(gw.gql(MeDocument, { id: "mock-user-x" })).rejects.toBeInstanceOf(
      GraphQLRequestError,
    );
  });

  it("reports a live gateway error as an error, with no second try anywhere else", async () => {
    const down = fakeFetch(() => new Response("bad gateway", { status: 502 }));
    const gw = new GatewayClient({
      baseUrl: "https://g.example.invalid",
      cookieHeader: null,
      fetch: down.fetcher,
      sessionCookie: "s",
    });
    await expect(gw.request("/setup/state")).rejects.toBeInstanceOf(ApiError);
    expect(down.calls).toHaveLength(1);

    const unreachable = new GatewayClient({
      baseUrl: "https://g.example.invalid",
      cookieHeader: null,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
      sessionCookie: "s",
    });
    await expect(unreachable.request("/setup/state")).rejects.toBeInstanceOf(
      GatewayUnreachableError,
    );
  });

  it("forgets the session when the gateway clears the cookie", async () => {
    const { fetcher } = fakeFetch(
      () =>
        new Response("{}", {
          headers: { "Set-Cookie": "sneakers_sid=; Path=/; Max-Age=-1; HttpOnly" },
        }),
    );
    const gw = new GatewayClient({
      baseUrl: "https://g.example.invalid",
      cookieHeader: "sneakers_sid=old",
      fetch: fetcher,
      sessionCookie: "sneakers_sid",
    });
    await gw.request("/auth/logout", { body: {}, method: "POST" });
    expect(gw.hasSessionCookie).toBe(false);
  });
});

describe("readCookie", () => {
  it("reads one cookie by exact name", () => {
    expect(readCookie("a=1; mock_sneakers_sid=2; sneakers_sid=3", "sneakers_sid")).toBe("3");
    expect(readCookie("mock_sneakers_sid=2", "sneakers_sid")).toBeNull();
    expect(readCookie(null, "x")).toBeNull();
  });
});
