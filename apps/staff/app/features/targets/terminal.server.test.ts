// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { loadTerminal, terminalAction } from "@/features/targets/terminal.server";

withMockGateway();

const KEY = "mock-secret-build-ssh";

const get = (id: string, user = "mock-user-alice") =>
  appRequest(`/secret/${id}/terminal`, { cookie: sessionCookie(user) });
const open = (id: string, user = "mock-user-alice") =>
  appRequest(`/secret/${id}/terminal`, {
    body: form({ intent: "open" }),
    cookie: sessionCookie(user),
    method: "POST",
  });

const sessionOf = async (id: string, user?: string) => {
  const d = await loadTerminal(get(id, user), id);
  return d.session;
};

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id)!;

describe("the terminal loader", () => {
  it("names the session: the key, the user and host, and whether the host is pinned", async () => {
    const d = await loadTerminal(get(KEY), KEY);
    expect(d).toEqual({
      secret: { id: KEY, name: "Build host deploy key" },
      session: {
        canPinHostKey: true,
        hostname: "build1.example.org",
        kind: "ready",
        pinned: true,
        targetId: "mock-target-build1",
        username: "deploy",
      },
    });
  });

  it("names the session for a Password Account (SSH) secret the same as an SSH key (#319)", async () => {
    const PASSWORD = "mock-secret-switch-ssh";
    const d = await loadTerminal(get(PASSWORD), PASSWORD);
    expect(d).toEqual({
      secret: { id: PASSWORD, name: "Lab switch console account" },
      session: {
        canPinHostKey: true,
        hostname: "switch1.example.org",
        kind: "ready",
        pinned: true,
        targetId: "mock-target-switch1",
        username: "netadmin",
      },
    });
  });

  it("only lets a site admin or root pin the host key", async () => {
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.ownerUserId = undefined;
    const session = await sessionOf(KEY, "mock-user-bob");
    expect(session).toMatchObject({ canPinHostKey: false, kind: "ready" });
  });

  it("says when a secret isn't an SSH key bound to an SSH target", async () => {
    expect(await sessionOf("mock-secret-edge-router")).toEqual({ kind: "not-ssh" });
    secret(KEY).targetId = undefined;
    expect(await sessionOf(KEY)).toEqual({ kind: "not-ssh" });
    secret(KEY).targetId = "mock-target-db1";
    expect(await sessionOf(KEY)).toEqual({ kind: "not-ssh" });
  });

  it("says when the key is locked or retired, without asking for its fields", async () => {
    // Dave isn't in the Platform engineers group and holds no lease, so nothing lets him read it.
    // A shared target, so the key's lock is all that stands in his way.
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.ownerUserId = undefined;
    expect(await sessionOf(KEY, "mock-user-dave")).toEqual({ kind: "locked" });
    secret(KEY).retired = true;
    expect(await sessionOf(KEY)).toEqual({ kind: "retired" });
  });

  it("answers 404 for a secret the user can't see", async () => {
    const thrown = await loadTerminal(
      get("mock-secret-alice-wifi", "mock-user-bob"),
      "mock-secret-alice-wifi",
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect((thrown as Response).status).toBe(404);
  });
});

const getChoosing = (id: string, targetId?: string, user = "mock-user-alice") =>
  appRequest(`/secret/${id}/terminal${targetId ? `?target=${targetId}` : ""}`, {
    cookie: sessionCookie(user),
  });

const openWith = (id: string, targetId: string, user = "mock-user-alice") =>
  appRequest(`/secret/${id}/terminal`, {
    body: form({ intent: "open", targetId }),
    cookie: sessionCookie(user),
    method: "POST",
  });

// #168: one SSH Key secret, attached to two targets, needs one picked before it's ready.
describe("the terminal loader, several targets (#168)", () => {
  const MULTI = "mock-secret-claude-ssh-key";

  it("asks which target when more than one is attached and none is chosen", async () => {
    const d = await loadTerminal(getChoosing(MULTI), MULTI);
    expect(d.session).toEqual({
      kind: "choose",
      targets: [
        { hostname: "build1.example.org", id: "mock-target-build1", name: "Build host" },
        { hostname: "build2.example.org", id: "mock-target-build2", name: "Build host 2" },
      ],
    });
  });

  it("is ready once a valid attached target is chosen", async () => {
    const d = await loadTerminal(getChoosing(MULTI, "mock-target-build2"), MULTI);
    expect(d.session).toMatchObject({
      hostname: "build2.example.org",
      kind: "ready",
      targetId: "mock-target-build2",
    });
  });

  it("asks again for a target that isn't attached to the secret", async () => {
    const d = await loadTerminal(getChoosing(MULTI, "mock-target-db1"), MULTI);
    expect(d.session.kind).toBe("choose");
  });

  it("needs no choice at all with a single attached target", async () => {
    const d = await loadTerminal(get(KEY), KEY);
    expect(d.session).toMatchObject({ kind: "ready", targetId: "mock-target-build1" });
  });
});

describe("the terminal action, several targets (#168)", () => {
  const MULTI = "mock-secret-claude-ssh-key";

  it("opens a session on the chosen target", async () => {
    const r = await terminalAction(openWith(MULTI, "mock-target-build2"), MULTI);
    expect(r).toMatchObject({ ok: true });
  });

  it("is refused when the chosen target isn't attached to the secret", async () => {
    const r = await terminalAction(openWith(MULTI, "mock-target-db1"), MULTI);
    expect(r).toMatchObject({ ok: false, refusal: { code: "FAILED_PRECONDITION" } });
  });
});

describe("the terminal action", () => {
  it("opens a session and hands the page its ticket", async () => {
    const r = await terminalAction(open(KEY), KEY);
    expect(r).toMatchObject({
      ok: true,
      ticket: { expiresInSeconds: 30, ticket: expect.stringMatching(/^mock-ticket-/) },
    });
  });

  it("opens a session for a Password Account (SSH) secret too (#319)", async () => {
    const PASSWORD = "mock-secret-switch-ssh";
    const r = await terminalAction(open(PASSWORD), PASSWORD);
    expect(r).toMatchObject({
      ok: true,
      ticket: { expiresInSeconds: 30, ticket: expect.stringMatching(/^mock-ticket-/) },
    });
  });

  it("hands back a refusal as data", async () => {
    expect(await terminalAction(open(KEY, "mock-user-dave"), KEY)).toMatchObject({
      ok: false,
      refusal: { code: "PERMISSION_DENIED", reason: "NO_ACCESS" },
    });
  });
});
