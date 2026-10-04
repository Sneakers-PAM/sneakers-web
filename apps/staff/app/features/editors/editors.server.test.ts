// @vitest-environment node
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  server,
  sessionCookie,
  withCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import {
  editorAction,
  type EditorLoad,
  loadEditSecret,
  loadNewSecret,
} from "@/features/editors/editors.server";

withMockGateway();

const ALICE = "mock-user-alice";
const DB = "mock-secret-db-admin";

const loadNew = (url = "/secret/new", user = ALICE): Promise<EditorLoad> =>
  withCookie(sessionCookie(user), ({ request }) => loadNewSecret(request))({
    context: {},
    params: {},
    request: appRequest(url),
  });

const loadEdit = (id: string, user = ALICE): Promise<EditorLoad> =>
  withCookie(sessionCookie(user), ({ params, request }) =>
    loadEditSecret(request, params.id ?? ""),
  )({
    context: {},
    params: { id },
    request: appRequest(`/secret/${id}/edit`),
  });

const act = (fields: Record<string, string>, id?: string, user = ALICE) =>
  withCookie(sessionCookie(user), ({ request }) => editorAction(request, id))({
    context: {},
    params: id ? { id } : {},
    request: appRequest(id ? `/secret/${id}/edit` : "/secret/new", {
      body: form(fields),
      method: "POST",
    }),
  });

const thrown = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (error: unknown) => error,
  );

const secretNamed = (name: string) => mockState.world.secrets.find((s) => s.name === name);

describe("loading the new secret form", () => {
  it("offers every type, the policies, and only the folders the user can add to", async () => {
    const d = await loadNew();
    if (!d.ok) throw new Error("expected the form");
    expect(d.mode).toBe("new");
    expect(d.types.map((t) => t.id)).toEqual(
      expect.arrayContaining(["type-acme-router", "type-acme-vpn", "type-door-code"]),
    );
    expect(d.folders.find((f) => f.id === "mock-folder-databases")?.path).toBe(
      "Platform / Databases",
    );
    expect(d.draft.folderId).toBe("");
    const bob = await loadNew("/secret/new", "mock-user-bob");
    if (!bob.ok) throw new Error("expected the form");
    expect(bob.folders.map((f) => f.id)).toContain("mock-folder-finance");
    expect(bob.folders.map((f) => f.id)).not.toContain("mock-folder-databases");
  });

  it("preselects the folder named in the address when the user can add to it", async () => {
    const d = await loadNew("/secret/new?folder=mock-folder-databases");
    expect(d.ok && d.draft.folderId).toBe("mock-folder-databases");
    const other = await loadNew("/secret/new?folder=mock-folder-databases", "mock-user-bob");
    expect(other.ok && other.draft.folderId).toBe("");
  });

  it("turns a failing gateway into a failure the page can retry", async () => {
    server.use(
      graphql
        .link(`${MOCK_GATEWAY_URL}/graphql`)
        .query("EditorsPickers", () =>
          HttpResponse.json({ errors: [{ extensions: { code: "UNAVAILABLE" }, message: "down" }] }),
        ),
    );
    const d = await loadNew();
    expect(d).toMatchObject({ failure: { retry: true }, ok: false });
  });
});

describe("loading the edit form", () => {
  it("brings the secret and its non-sensitive values, never a sensitive one", async () => {
    const d = await loadEdit(DB);
    if (!d.ok) throw new Error("expected the form");
    expect(d.mode).toBe("edit");
    expect(d.draft).toMatchObject({
      folderId: "mock-folder-databases",
      name: "DB admin",
      typeId: "type-database-account",
    });
    expect(d.draft.values.username).toBe("postgres_admin");
    expect(d.draft.values.password).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain("mock-Tongue-Eyelet");
  });

  it("says why when the user can't read the secret's values", async () => {
    expect(await loadEdit("mock-secret-helpdesk", "mock-user-bob")).toMatchObject({
      failure: { retry: false },
      ok: false,
    });
  });

  it("answers 404 for a secret the user can't see", async () => {
    expect(await thrown(loadEdit("mock-secret-alice-wifi", "mock-user-bob"))).toMatchObject({
      init: { status: 404 },
    });
  });
});

describe("saving", () => {
  const base = {
    expires: "",
    folderId: "mock-folder-databases",
    intent: "save",
    name: "Reporting writer",
    targetId: "",
    typeId: "type-database-account",
  };

  it("creates the secret and goes to it", async () => {
    const r = await thrown(
      act({
        ...base,
        "f:engine": "PostgreSQL",
        "f:password": "mock-Aglet-Strong-55!",
        "f:server": "db1.example.org",
        "f:username": "report_writer",
      }),
    );
    const s = secretNamed("Reporting writer");
    expect(s?.fields.password).toBe("mock-Aglet-Strong-55!");
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe(`/secret/${s?.id}`);
  });

  it("checks the fields on the server too, and never sends them on with a problem", async () => {
    const r = await act({ ...base, "f:password": "x", "f:username": "report_writer" });
    expect(r).toMatchObject({ intent: "save", ok: false });
    if (r.ok || r.intent !== "save") throw new Error("expected problems");
    expect(Object.keys(r.problems?.fields ?? {})).toContain("server");
    expect(secretNamed("Reporting writer")).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain('"x"');
  });

  it("holds a strict password field to its policy", async () => {
    const r = await act({
      ...base,
      "f:code": "12",
      "f:location": "North door",
      name: "Door",
      typeId: "type-door-code",
    });
    if (r.ok || r.intent !== "save") throw new Error("expected problems");
    expect(r.problems?.fields.code?.summary).toBe("Code doesn't meet the policy");
  });

  it("passes the gateway's refusal of an edit back for the page", async () => {
    const r = await act(
      {
        ...base,
        "f:password": "",
        "f:server": "db1.example.org",
        "f:username": "u",
        name: "DB admin",
      },
      DB,
      "mock-user-bob",
    );
    expect(r).toMatchObject({ intent: "save", ok: false, refusal: { code: "PERMISSION_DENIED" } });
  });

  it("passes a gateway refusal back for the page", async () => {
    const r = await act(
      {
        ...base,
        "f:password": "mock-Aglet-Strong-55!",
        "f:server": "db1.example.org",
        "f:username": "u",
      },
      undefined,
      "mock-user-bob",
    );
    expect(r).toMatchObject({ intent: "save", ok: false, refusal: { code: "PERMISSION_DENIED" } });
  });

  it("keeps a blank sensitive value on edit and records what changed", async () => {
    const r = await thrown(
      act(
        {
          ...base,
          "f:engine": "PostgreSQL",
          "f:password": "",
          "f:port": "5433",
          "f:server": "db1.example.org",
          "f:username": "postgres_admin",
          name: "DB admin",
          targetId: "mock-target-db1",
        },
        DB,
      ),
    );
    expect((r as Response).headers.get("Location")).toBe(`/secret/${DB}`);
    const s = mockState.world.secrets.find((x) => x.id === DB);
    expect(s?.fields.password).toBe("mock-Tongue-Eyelet-91");
    expect(s?.versions[0]?.changedFieldKeys).toContain("port");
    expect(s?.versions[0]?.changedFieldKeys).not.toContain("password");
  });
});

describe("the editor's helpers", () => {
  it("generates a key pair", async () => {
    const r = await act({ format: "Ed25519", intent: "generate-key" });
    expect(r).toMatchObject({ intent: "generate-key", ok: true });
    if (!r.ok || r.intent !== "generate-key") throw new Error("expected a pair");
    expect(r.keyPair.publicKey).toMatch(/^ssh-ed25519 /);
  });

  it("makes a personal target and hands it back to pick", async () => {
    const r = await act({
      connectionId: "mock-conn-postgres",
      hostname: "reports.example.org",
      intent: "create-target",
      name: "reports-db",
    });
    expect(r).toMatchObject({ intent: "create-target", ok: true, target: { name: "reports-db" } });
  });

  it("imports a certificate and goes to it, or asks which entry of a bundle", async () => {
    const file = Buffer.from(
      "-----BEGIN CERTIFICATE-----\nmock\n-----END CERTIFICATE-----",
    ).toString("base64");
    const r = await thrown(
      act({
        fileBase64: file,
        folderId: "mock-folder-certificates",
        intent: "import-cert",
        name: "api.example.org",
        passphrase: "",
      }),
    );
    expect((r as Response).headers.get("Location")).toBe(
      `/secret/${secretNamed("api.example.org")?.id}`,
    );
    const bundle = await act({
      fileBase64: Buffer.from("mock-bundle: web, api").toString("base64"),
      folderId: "mock-folder-certificates",
      intent: "import-cert",
      name: "bundle",
    });
    expect(bundle).toMatchObject({ aliases: ["web", "api"], intent: "import-cert", ok: true });
  });
});
