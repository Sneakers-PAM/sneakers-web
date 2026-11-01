// @vitest-environment node
import { edge, MOCK_BANNER } from "#api/edge/mock.server";

const answers = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(Response.json(body, { status })));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the mock edge", () => {
  it("shows the banner and calls the local mock server by default", () => {
    expect(edge.banner).toBe(MOCK_BANNER);
    expect(edge.gatewayUrl).toBe("http://127.0.0.1:5171");
  });

  it("offers the people the mock server lists, without the disabled ones", async () => {
    vi.stubGlobal(
      "fetch",
      answers([
        { id: "a", name: "Alice", note: "site admin" },
        { disabled: true, id: "b", name: "Bob", note: "everyday user" },
      ]),
    );
    await expect(edge.quickLogin?.users()).resolves.toEqual([
      { id: "a", label: "Alice", note: "site admin" },
    ]);
  });

  it("turns the mock server's sign-in into a session cookie for the browser", async () => {
    vi.stubGlobal("fetch", answers({ cookie: "mock_sneakers_sid=abc", enroll: true }));
    await expect(edge.quickLogin?.signIn("a")).resolves.toEqual({
      cookie: "mock_sneakers_sid=abc; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800",
      enroll: true,
    });
  });

  it("answers null for a person the mock server refuses", async () => {
    vi.stubGlobal("fetch", answers({ error: "unknown_person" }, 404));
    await expect(edge.quickLogin?.signIn("nobody")).resolves.toBeNull();
  });

  it("won't start without a mock server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("refused"))),
    );
    await expect(edge.start()).rejects.toThrow(/npm run mock/);
  });

  it("won't start against a server with another session cookie", async () => {
    vi.stubGlobal("fetch", answers({ sessionCookie: "sneakers_sid" }));
    await expect(edge.start()).rejects.toThrow(/uses sneakers_sid/);
  });
});
