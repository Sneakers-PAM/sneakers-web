import { buildReport, type DiagnosticsData } from "#shell/diagnostics/report";

const component = (name: string, version: null | string, status = "OK") =>
  ({
    commit: version ? "abc1234" : null,
    dependencies: null,
    name,
    status,
    version,
  }) as NonNullable<DiagnosticsData["gateway"]>["gateway"];

const data: DiagnosticsData = {
  app: { commit: "f00dfeed", name: "staff", version: "0.4.0" },
  gateway: {
    actor: { id: "user-1", roles: ["user", "site-admin"], username: "morgan" },
    appliance: null,
    box: null,
    gateway: component("gateway", "v0.1.0"),
    generatedAt: "2026-10-05T12:00:00Z",
    productVersion: null,
    publicUrl: "https://pam.example.org",
    services: [component("vault", "v0.1.0"), component("connector", null, "NOT_CONFIGURED")],
    thirdParty: [component("postgres", "17.11"), component("rabbitmq", null, "NOT_CONFIGURED")],
    traceId: "1111",
  },
};

const at = new Date("2026-10-05T13:14:15Z");

/** A report whose gateway names MCP with mcpStatus and three unused third-party parts. */
const withFeatures = (mcpStatus: string) =>
  buildReport({
    data: {
      ...data,
      gateway: {
        ...data.gateway!,
        services: [
          component("vault", "v0.1.0"),
          component("mcp", mcpStatus === "OK" ? "v0.1.0" : null, mcpStatus),
        ],
        thirdParty: [
          component("postgres", "17.11"),
          component("hydra", null, "NOT_CONFIGURED"),
          component("polis", null, "NOT_CONFIGURED"),
          component("rabbitmq", null, "NOT_CONFIGURED"),
        ],
      },
    },
    now: at,
    timeZone: "UTC",
    url: "https://pam.example.org/",
    userAgent: "UA",
  });
describe("buildReport", () => {
  it("names the product once and, on the appliance, the box", () => {
    const onBox: DiagnosticsData = {
      ...data,
      gateway: {
        ...data.gateway!,
        appliance: "0.1.0-m",
        box: { baseOS: "0.1.0-m", baseWeb: "0.1.0-m2", fqdn: "box1.example.org" },
        productVersion: "0.1.0",
        services: [component("identity", "0.1.0"), component("connector", "0.1.0")],
      },
    };
    const { json, text } = buildReport({
      data: onBox,
      now: at,
      timeZone: "UTC",
      url: "https://box1.example.org/",
      userAgent: "Mozilla/5.0 Test",
    });
    expect(json.product).toBe("0.1.0");
    expect(json.box).toEqual({ baseOS: "0.1.0-m", baseWeb: "0.1.0-m2", fqdn: "box1.example.org" });
    expect(json.appliance).toBe("0.1.0-m");
    const lines = text.split("\n");
    expect(lines[1]).toBe("Product: Sneakers 0.1.0");
    expect(lines.filter((l) => l.startsWith("Product:"))).toHaveLength(1);
    expect(text).toContain("Appliance: Base OS 0.1.0-m, Base Web 0.1.0-m2, box1.example.org");
    expect(text).toContain("  connector: 0.1.0 (abc1234)");
  });

  it("copies each build's short commit, never the full one", () => {
    const full = "be456ff05e19b96c8b8978785c6fd7a437524bbb";
    const { json, text } = buildReport({
      data: {
        app: { commit: full, name: "staff", version: "0.1.0" },
        gateway: {
          ...data.gateway!,
          gateway: { ...component("gateway", "0.1.0"), commit: full },
          services: [{ ...component("vault", "0.1.0"), commit: full }],
        },
      },
      now: at,
      timeZone: "UTC",
      url: "https://pam.example.org/",
      userAgent: "Mozilla/5.0 Test",
    });
    expect(text).toContain("App: staff 0.1.0 (be456ff)");
    expect(text).toContain("Gateway: 0.1.0 (be456ff)");
    expect(text).toContain("  vault: 0.1.0 (be456ff)");
    expect(json.app.commit).toBe("be456ff");
    expect(text).not.toContain(full);
  });

  it("says so when the product version or the box isn't known", () => {
    const { json, text } = buildReport({
      data,
      now: at,
      timeZone: "UTC",
      url: "https://pam.example.org/",
      userAgent: "Mozilla/5.0 Test",
    });
    expect(json.product).toBeNull();
    expect(json.box).toBeNull();
    expect(text).toContain("Product: Sneakers (version unknown)");
    expect(text).toContain("Appliance: not appliance");
  });

  it("names the time, page, problem, user, builds and browser", () => {
    const { json, text } = buildReport({
      data,
      now: at,
      problem: {
        code: "FAILED_PRECONDITION",
        domain: "sneakers.workflow",
        message: "Someone has this secret checked out.",
        operation: "CheckOut",
        reason: "CHECKOUT_LEASE_HELD",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      },
      route: "routes/secret",
      timeZone: "America/New_York",
      url: "https://pam.example.org/secret/s-1?tab=fields#top",
      userAgent: "Mozilla/5.0 Test",
    });
    expect(json.time).toEqual({
      local: "2026-10-05 09:14:15",
      timeZone: "America/New_York",
      utc: "2026-10-05T13:14:15.000Z",
    });
    expect(json.page).toEqual({ path: "/secret/s-1", route: "routes/secret" });
    expect(json.problem).toMatchObject({ operation: "CheckOut", reason: "CHECKOUT_LEASE_HELD" });
    expect(json.user).toEqual({ id: "user-1", roles: ["user", "site-admin"], username: "morgan" });
    const { app } = json;
    expect(app).toEqual({ commit: "f00dfee", name: "staff", version: "0.4.0" });
    expect(json.appliance).toBe("not appliance");
    expect(json.services).toContainEqual({
      commit: null,
      name: "connector",
      status: "NOT_CONFIGURED",
      version: null,
    });
    expect(text).toContain("CHECKOUT_LEASE_HELD");
    expect(text).toContain("trace 4bf92f3577b34da6a3ce929d0e0e4736");
    expect(text).toContain("postgres: 17.11");
    expect(text).toContain("Mozilla/5.0 Test");
    expect(text).toContain("```json\n");
    expect(JSON.parse(text.split("```json\n", 2)[1]!.split("\n```", 1)[0]!)).toEqual(json);
  });

  it("lists each service's dependency states, with the error class and version", () => {
    const withDeps = {
      ...data,
      gateway: {
        ...data.gateway!,
        services: [
          {
            ...component("vault", "v0.1.0", "UNAVAILABLE"),
            dependencies: [
              { error: null, name: "postgres", required: true, state: "OK", version: "17.11" },
              { error: "timeout", name: "valkey", required: true, state: "DOWN", version: null },
              {
                error: "refused",
                name: "audit",
                required: false,
                state: "DEGRADED",
                version: null,
              },
            ],
          },
        ],
      },
    } as unknown as DiagnosticsData;
    const { json, text } = buildReport({
      data: withDeps,
      now: at,
      timeZone: "UTC",
      url: "https://pam.example.org/",
      userAgent: "UA",
    });
    expect(json.services[0]?.dependencies).toEqual([
      { name: "postgres", required: true, state: "OK", version: "17.11" },
      { error: "timeout", name: "valkey", required: true, state: "DOWN" },
      { error: "refused", name: "audit", required: false, state: "DEGRADED" },
    ]);
    expect(text).toContain(
      "  vault: unavailable, v0.1.0 (abc1234); postgres ok 17.11, valkey down (timeout), audit degraded (refused, optional)",
    );
  });

  it("leaves out unused third-party components and shows MCP as a feature that is on or off", () => {
    const off = withFeatures("NOT_CONFIGURED");
    expect(off.json.thirdParty.map((c) => c.name)).toEqual(["postgres"]);
    expect(off.json.services.map((c) => c.name)).toEqual(["vault"]);
    expect(off.json.features).toEqual([{ build: null, name: "mcp", on: false }]);
    expect(off.text).not.toMatch(/hydra|polis|rabbitmq|not configured/);
    expect(off.text).toContain("Controllable features:\n  mcp: off\n");
    const on = withFeatures("OK");
    expect(on.json.features).toEqual([{ build: "v0.1.0 (abc1234)", name: "mcp", on: true }]);
    expect(on.text).toContain("  mcp: on, v0.1.0 (abc1234)");
    expect(withFeatures("UNAVAILABLE").text).toContain("  mcp: on, unavailable");
  });

  it("still reports the page and the app when the gateway can't be read", () => {
    const { json, text } = buildReport({
      data: { ...data, gateway: null },
      now: at,
      timeZone: "UTC",
      url: "https://pam.example.org/",
      userAgent: "UA",
    });
    expect(json.user).toBeNull();
    expect(json.services).toEqual([]);
    expect(text).toContain("Gateway: not reachable");
  });

  it("never copies a token, cookie, session id or secret value", () => {
    const leaky = {
      ...data,
      gateway: {
        ...data.gateway!,
        cookie: "mock_sneakers_sid=SID-VALUE",
        secretValue: "hunter2-FIELD",
      },
    } as unknown as DiagnosticsData;
    const { text } = buildReport({
      data: leaky,
      now: at,
      problem: {
        message:
          "Bad token snk_u_ABCDEF123 with Bearer eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl and sid=SID-VALUE password: hunter2-FIELD",
        operation: "RevealField",
      },
      timeZone: "UTC",
      url: "https://pam.example.org/secret/s-1?token=snk_u_QUERYTOKEN&value=hunter2-FIELD",
      userAgent: "UA",
    });
    for (const bad of ["snk_u_", "eyJ", "SID-VALUE", "hunter2-FIELD", "QUERYTOKEN", "?token"]) {
      expect(text).not.toContain(bad);
    }
    expect(text).toContain("[redacted]");
  });
});
