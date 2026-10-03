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

const sessionOf = async (id: string) => {
  const d = await loadTerminal(get(id), id);
  return d.session;
};

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id)!;

describe("the terminal loader", () => {
  it("names the session: the key, the user and host, and whether the host is pinned", async () => {
    const d = await loadTerminal(get(KEY), KEY);
    expect(d).toEqual({
      secret: { id: KEY, name: "Build host deploy key" },
      session: {
        hostname: "build1.example.org",
        kind: "ready",
        pinned: true,
        username: "deploy",
      },
    });
  });

  it("says when a secret isn't an SSH key bound to an SSH target", async () => {
    expect(await sessionOf("mock-secret-edge-router")).toEqual({ kind: "not-ssh" });
    secret(KEY).targetId = undefined;
    expect(await sessionOf(KEY)).toEqual({ kind: "not-ssh" });
    secret(KEY).targetId = "mock-target-db1";
    expect(await sessionOf(KEY)).toEqual({ kind: "not-ssh" });
  });

  it("says when the key is locked or retired, without asking for its fields", async () => {
    secret(KEY).canRead = false;
    expect(await sessionOf(KEY)).toEqual({ kind: "locked" });
    secret(KEY).canRead = true;
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

describe("the terminal action", () => {
  it("opens a session and hands the page its ticket", async () => {
    const r = await terminalAction(open(KEY), KEY);
    expect(r).toMatchObject({
      ok: true,
      ticket: { expiresInSeconds: 30, ticket: expect.stringMatching(/^mock-ticket-/) },
    });
  });

  it("hands back a refusal as data", async () => {
    secret(KEY).canRead = false;
    expect(await terminalAction(open(KEY), KEY)).toMatchObject({
      ok: false,
      refusal: { code: "PERMISSION_DENIED", reason: "NO_ACCESS" },
    });
  });
});
