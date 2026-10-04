// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { editorAction, type EditorLoad, loadEditSecret } from "@/features/editors/editors.server";

withMockGateway();

const loadEdit = (id: string, user = "mock-user-alice"): Promise<EditorLoad> =>
  withCookie(sessionCookie(user), ({ params, request }) =>
    loadEditSecret(request, params.id ?? ""),
  )({
    context: {},
    params: { id },
    request: appRequest(`/secret/${id}/edit`),
  });

const act = (id: string, fields: Record<string, string>, user = "mock-user-alice") =>
  withCookie(sessionCookie(user), ({ request }) => editorAction(request, id))({
    context: {},
    params: { id },
    request: appRequest(`/secret/${id}/edit`, { body: form(fields), method: "POST" }),
  });

const thrown = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (error: unknown) => error,
  );

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const payroll = {
  expires: "",
  "f:password": "",
  "f:url": "https://payroll.example.com",
  "f:username": "finance-team",
  intent: "save",
  name: "Payroll portal",
  targetId: "",
  typeId: "type-web-password",
};

describe("where an edited secret can move", () => {
  it("offers the folders the user manages, labelled as browse labels them", async () => {
    const d = await loadEdit("mock-secret-payroll", "mock-user-bob");
    if (!d.ok) throw new Error("expected the form");
    const paths = d.folders.map((f) => f.path);
    expect(paths).toContain("Finance");
    expect(paths).toContain("Personal · My secrets");
    expect(paths).not.toContain("Platform / Databases");
    expect(d.moves?.["mock-folder-bob"]).toBe("request");
    expect(d.moves?.["mock-folder-archive"]).toBe("direct");
  });

  it("keeps the secret's own folder on offer to an approver who doesn't manage it", async () => {
    mockState.world.folderRules.push({
      folderId: "mock-folder-databases",
      grants: { A: "allow" },
      id: "mock-rule-bob-approves",
      subjectKind: "user",
      subjectName: "mock-user-bob",
    });
    const d = await loadEdit("mock-secret-db-admin", "mock-user-bob");
    if (!d.ok) throw new Error("expected the form");
    expect(d.draft.folderId).toBe("mock-folder-databases");
    expect(d.folders.map((f) => f.id)).toContain("mock-folder-databases");
  });

  it("moves a secret with the edit when the gate lets it go straight there", async () => {
    const r = await thrown(
      act("mock-secret-payroll", { ...payroll, folderId: "mock-folder-archive" }, "mock-user-bob"),
    );
    expect((r as Response).headers.get("Location")).toBe("/secret/mock-secret-payroll");
    expect(secret("mock-secret-payroll")?.folderId).toBe("mock-folder-archive");
  });

  it("saves the other edits and files a request when the move needs a site admin", async () => {
    const r = await thrown(
      act(
        "mock-secret-payroll",
        {
          ...payroll,
          folderId: "mock-folder-bob",
          moveReason: "Only I use it now.",
          name: "Payroll",
        },
        "mock-user-bob",
      ),
    );
    expect((r as Response).headers.get("Location")).toBe("/secret/mock-secret-payroll");
    expect(secret("mock-secret-payroll")).toMatchObject({
      folderId: "mock-folder-finance",
      name: "Payroll",
    });
    expect(mockState.world.requests.at(-1)).toMatchObject({
      destParentId: "mock-folder-bob",
      kind: "secret_move",
      reason: "Only I use it now.",
    });
  });

  it("wants a reason for a move request", async () => {
    const r = await act(
      "mock-secret-payroll",
      { ...payroll, folderId: "mock-folder-bob" },
      "mock-user-bob",
    );
    expect(r).toMatchObject({
      intent: "save",
      ok: false,
      problems: { basics: { folderId: { summary: "A move request needs a reason" } } },
    });
    expect(secret("mock-secret-payroll")?.folderId).toBe("mock-folder-finance");
  });

  it("lets a site admin move into someone's personal folder straight away", async () => {
    const d = await loadEdit("mock-secret-db-admin");
    expect(d.ok && d.moves?.["mock-folder-alice"]).toBe("direct");
  });
});
