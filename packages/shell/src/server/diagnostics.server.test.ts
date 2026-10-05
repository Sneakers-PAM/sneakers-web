// @vitest-environment node
import { appRequest, sessionCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";

import type { DiagnosticsData } from "#shell/diagnostics/report";

import { diagnosticsLoader } from "#shell/server/diagnostics.server";

withMockGateway();

const load = async (cookie?: string) => {
  const response = (await diagnosticsLoader("staff")({
    context: {},
    params: {},
    request: appRequest("/resources/diagnostics", cookie ? { cookie } : {}),
  } as never)) as Response;
  return { body: (await response.json()) as DiagnosticsData, response };
};

describe("the diagnostics resource", () => {
  it("answers the app's build and the gateway's report for a signed-in user", async () => {
    const cookie = sessionCookie("mock-user-alice");
    const { body, response } = await load(cookie);
    const { app } = body;
    expect(app).toMatchObject({ name: "staff" });
    expect(app.version).toBeTruthy();
    expect(body.gateway?.actor).toMatchObject({ id: "mock-user-alice", username: "alice" });
    expect(body.gateway?.gateway.version).toMatch(/^mock-/);
    expect(body.gateway?.services.map((s) => s.name)).toContain("vault");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(JSON.stringify(body)).not.toContain(cookie.split("=", 2)[1]!);
  });

  it("answers the app's build alone when nobody is signed in", async () => {
    const { body } = await load();
    expect(body.gateway).toBeNull();
    const { app } = body;
    expect(app.name).toBe("staff");
  });
});
