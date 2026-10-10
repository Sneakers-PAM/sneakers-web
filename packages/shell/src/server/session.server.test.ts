// @vitest-environment node
import { MOCK_GATEWAY_URL } from "@sneakers-web/mock-gateway";
import { appRequest, server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { http, HttpResponse } from "msw";

import { needsSetup, requireUser } from "#shell/server/session.server";

withMockGateway();

const thrown = async (p: Promise<unknown>): Promise<Response> => {
  try {
    await p;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("expected a thrown response");
};

describe("requireUser", () => {
  it("sends a visitor with no session to sign-in, keeping where they were going", async () => {
    const r = await thrown(requireUser(appRequest("/checkouts?x=1")));
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/sign-in?next=%2Fcheckouts%3Fx%3D1");
  });

  it("sends a background fetch to a resource route back to the page that made it, not the route", async () => {
    const r = await thrown(
      requireUser(
        appRequest("/resources/notifications?count=1", {
          headers: { Referer: "https://app.example.invalid/secrets?page=2" },
        }),
      ),
    );
    expect(r.headers.get("Location")).toBe("/sign-in?next=%2Fsecrets%3Fpage%3D2");
  });

  it("sends a resource route's fetch with no Referer to the app's start, not the route", async () => {
    const r = await thrown(requireUser(appRequest("/resources/notifications?count=1")));
    expect(r.headers.get("Location")).toBe("/sign-in?next=%2F");
  });

  it("never returns to a resource route even by way of another resource route's Referer", async () => {
    const r = await thrown(
      requireUser(
        appRequest("/resources/notifications?count=1", {
          headers: { Referer: "https://app.example.invalid/resources/diagnostics" },
        }),
      ),
    );
    expect(r.headers.get("Location")).toBe("/sign-in?next=%2F");
  });

  it("says the session ended when the cookie is there but the gateway no longer knows it", async () => {
    const r = await thrown(requireUser(appRequest("/", { cookie: "mock_sneakers_sid=gone" })));
    expect(r.headers.get("Location")).toContain("ended=1");
  });

  it("shows the gateway being down as an error, and asks nothing else", async () => {
    const seen: string[] = [];
    server.events.on("request:start", ({ request }) => seen.push(new URL(request.url).pathname));
    server.use(http.get(`${MOCK_GATEWAY_URL}/auth/session`, () => HttpResponse.error()));
    const r = await thrown(requireUser(appRequest("/", { cookie: "mock_sneakers_sid=any" })));
    expect(r.status).toBe(503);
    expect(seen).toEqual(["/auth/session"]);
  });

  it("reports an install that needs setup", async () => {
    const { mockState } = await import("@sneakers-web/mock-gateway");
    mockState.needsSetup = true;
    expect(await needsSetup(appRequest("/"))).toBe(true);
  });
});
