// @vitest-environment node
import { MOCK_GATEWAY_URL } from "@sneakers-web/mock-gateway";
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

import { loadSecret, secretAction, type SecretLoad } from "@/features/secret/secret.server";

withMockGateway();

const VPN = "mock-secret-acme-vpn";
const DB = "mock-secret-db-admin";

const load = async (id: string, user = "mock-user-alice"): Promise<SecretLoad> => {
  const run = withCookie(sessionCookie(user), ({ params, request }) =>
    loadSecret(request, params.id ?? ""),
  );
  return run({ context: {}, params: { id }, request: appRequest(`/secret/${id}`) });
};

const act = async (id: string, fields: Record<string, string>, user = "mock-user-alice") => {
  const run = withCookie(sessionCookie(user), ({ params, request }) =>
    secretAction(request, params.id ?? ""),
  );
  return run({
    context: {},
    params: { id },
    request: appRequest(`/secret/${id}`, { body: form(fields), method: "POST" }),
  });
};

const thrown = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (error: unknown) => error,
  );

describe("loading a secret", () => {
  it("brings the secret, its type, folder path, target and non-sensitive fields, never a sensitive value", async () => {
    const d = await load(VPN);
    if (!d.ok) throw new Error("expected the page");
    expect(d.secret.name).toBe("Acme VPN");
    expect(d.type?.name).toBe("Active Directory Account");
    expect(d.folderPath.map((f) => f.name)).toEqual(["Platform", "Network"]);
    expect(d.target?.hostname).toBe("dc1.corp.example.org");
    expect(d.fields.username).toBe("svc-vpn");
    expect(d.access.read).toBe(true);
    expect(JSON.stringify(d)).not.toContain("mock-Lace-Up");
  });

  it("shows the history to the folder's managers", async () => {
    const d = await load(DB);
    if (!d.ok) throw new Error("expected the page");
    expect(d.history?.map((v) => v.versionNo)).toEqual([3, 2, 1]);
  });

  it("shows someone without read the secret exists, with no fields and no history", async () => {
    const d = await load(VPN, "mock-user-bob");
    if (!d.ok) throw new Error("expected the page");
    expect(d.access).toMatchObject({ informed: true, read: false });
    expect(d.fields).toEqual({});
    expect(d.history).toBeNull();
  });

  it("answers 404 for a secret the person can't see", async () => {
    const error = await thrown(load("mock-secret-alice-wifi", "mock-user-bob"));
    expect(error).toMatchObject({ init: { status: 404 } });
  });

  it("turns a failing gateway into a failure the page can retry", async () => {
    server.use(
      graphql.link(`${MOCK_GATEWAY_URL}/graphql`).query("SecretDetail", () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault is down" }],
        }),
      ),
    );
    const d = await load(VPN);
    expect(d).toMatchObject({ failure: { retry: true }, ok: false });
  });
});

describe("acting on a secret", () => {
  it("reveals a value only in the action's answer", async () => {
    const r = await act(VPN, { fieldKey: "password", intent: "reveal" });
    expect(r).toMatchObject({ fieldKey: "password", intent: "reveal", ok: true });
    expect(r.ok && r.value).toBe("mock-Lace-Up-4417");
  });

  it("passes a step-up refusal back to the page", async () => {
    const r = await act("mock-secret-portal-cert", { fieldKey: "privateKey", intent: "reveal" });
    expect(r).toMatchObject({ ok: false, refusal: { reason: "STEP_UP_REQUIRED" } });
  });

  it("breaks glass and hands back every field", async () => {
    const r = await act(VPN, { code: "123456", intent: "break-glass", reason: "outage" });
    expect(r.ok && r.fields?.find((f) => f.key === "password")?.value).toBe("mock-Lace-Up-4417");
  });

  it("needs a reason to break glass", async () => {
    const r = await act(VPN, { code: "123456", intent: "break-glass", reason: " " });
    expect(r).toMatchObject({ ok: false, refusal: { code: "INVALID_ARGUMENT" } });
  });

  it("rotates, retires and restores, saying what happened", async () => {
    expect(await act(DB, { intent: "rotate" })).toMatchObject({ ok: true });
    expect(await act(DB, { intent: "retire" })).toMatchObject({
      done: "DB admin retired.",
      ok: true,
    });
    expect(await act(DB, { intent: "restore" })).toMatchObject({ ok: true });
  });

  it("deletes and goes back to the folder", async () => {
    const r = await thrown(act(DB, { intent: "delete" }));
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/browse/mock-folder-databases");
  });

  it("exports a certificate as a file for the browser", async () => {
    const r = await act("mock-secret-portal-cert", { format: "pem-fullchain", intent: "export" });
    expect(r.ok && r.file?.filename).toBe("portal.example.org.pem");
  });

  it("returns a refusal for an action the person may not take", async () => {
    const r = await act(DB, { intent: "retire" }, "mock-user-bob");
    expect(r).toMatchObject({ ok: false, refusal: { code: "PERMISSION_DENIED" } });
  });
});
