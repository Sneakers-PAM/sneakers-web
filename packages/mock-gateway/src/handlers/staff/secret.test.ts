// @vitest-environment node
import {
  AdminSetFolderRevealStepUpDocument,
  AgentsDecideUseDocument,
  auth,
  GatewayClient,
  GraphQLRequestError,
  SecretAccessDocument,
  SecretBreakGlassDocument,
  SecretDeleteDocument,
  SecretDetailDocument,
  SecretExportCertificateDocument,
  SecretFieldsDocument,
  SecretPrepareRevealDocument,
  SecretRedeemRevealDocument,
  SecretReplaceCertificateDocument,
  SecretRestoreDocument,
  SecretRetireDocument,
  SecretRevealDocument,
  SecretRevealVersionDocument,
  SecretRotateDocument,
  SecretSetAutomationDocument,
  SecretSetTokenApprovalDocument,
  SecretVersionsDocument,
  stepUp,
} from "@sneakers-web/api-client";

import { settings } from "#mock/admin/settings";
import { userById } from "#mock/fixtures/users";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const VPN = "mock-secret-acme-vpn";
const DB = "mock-secret-db-admin";
const CERT = "mock-secret-portal-cert";
const WIFI = "mock-secret-alice-wifi";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const refusal = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  const refused = error as GraphQLRequestError;
  return { code: refused.code, reason: refused.reason };
};

const world = () => mockState.world;
const secret = (id: string) => world().secrets.find((s) => s.id === id);
const b64 = (text: string) => Buffer.from(text).toString("base64");

describe("secret detail in the mock gateway", () => {
  it("answers the secret, its types, folders and targets without a single field value", async () => {
    const gw = await as(ALICE);
    const d = await gw.gql(SecretDetailDocument, { id: VPN });
    expect(d.secret?.name).toBe("Acme VPN");
    expect(d.secretTypes.find((t) => t.id === "type-active-directory")?.checkout).toBe(true);
    expect(d.folders.map((f) => f.id)).toContain("mock-folder-network");
    expect(d.targets.find((t) => t.id === "mock-target-dc1")?.hostname).toBe(
      "dc1.corp.example.org",
    );
    expect(JSON.stringify(d)).not.toContain("mock-Lace-Up");
  });

  it("hides another person's personal secret, as if it didn't exist", async () => {
    const gw = await as(BOB);
    const d = await gw.gql(SecretDetailDocument, { id: WIFI });
    expect(d.secret).toBeNull();
    expect(d.folders.map((f) => f.id)).not.toContain("mock-folder-alice-lab");
    expect(await refusal(gw.gql(SecretAccessDocument, { secretId: WIFI }))).toEqual({
      code: "NOT_FOUND",
      reason: undefined,
    });
  });

  it("lets anyone see a shared secret exists, but not read a locked one", async () => {
    const bob = await as(BOB);
    const id = "mock-secret-helpdesk";
    expect(await bob.gql(SecretDetailDocument, { id }).then((r) => r.secret?.name)).toBe(
      "Helpdesk reset account",
    );
    const access = await bob.gql(SecretAccessDocument, { secretId: id });
    expect(access.mySecretAccess).toEqual({
      approve: false,
      informed: true,
      manage: false,
      read: false,
      reveal: false,
    });
    expect(await refusal(bob.gql(SecretFieldsDocument, { id }))).toMatchObject({
      code: "PERMISSION_DENIED",
    });

    const held = await bob.gql(SecretAccessDocument, { secretId: "mock-secret-build-ssh" });
    expect(held.mySecretAccess).toMatchObject({ manage: false, read: true, reveal: true });
  });

  it("reveals a checkout secret's values to anyone who can read it, checked out or not", async () => {
    // Read permission is the control; a check-out is a workflow aid the server doesn't enforce.
    const ssh = "mock-secret-build-ssh";
    // The fixture holds non-owners' reveals of this key for approval; that's tested below.
    secret(ssh)!.requireTokenApproval = false;
    const alice = await as(ALICE);
    const { revealSecretField: unheld } = await alice.gql(SecretRevealDocument, {
      fieldKey: "passphrase",
      id: ssh,
    });
    expect(unheld).toBe(secret(ssh)?.fields.passphrase);
    userById(ALICE)?.roles.push("recovery");
    await stepUp(alice, { code: "123456", kind: "totp" });
    const old = await alice.gql(SecretRevealVersionDocument, {
      fieldKey: "passphrase",
      secretId: ssh,
      versionNo: 1,
    });
    expect(old.revealSecretVersionField).toBeTruthy();

    const bob = await as(BOB);
    const { revealSecretField } = await bob.gql(SecretRevealDocument, {
      fieldKey: "passphrase",
      id: ssh,
    });
    expect(revealSecretField).toBe(secret(ssh)?.fields.passphrase);

    // Break glass is the way past a checkout lock.
    const glass = await alice.gql(SecretBreakGlassDocument, {
      code: "123456",
      reason: "the holder is away",
      secretId: ssh,
    });
    expect(glass.breakGlassSecret.find((f) => f.key === "passphrase")?.value).toBe(
      secret(ssh)?.fields.passphrase,
    );
  });

  it("gives only non-sensitive values, and a sensitive one only by reveal", async () => {
    const gw = await as(ALICE);
    const { secretFields } = await gw.gql(SecretFieldsDocument, { id: VPN });
    const keys = secretFields.map((f) => f.key);
    expect(keys).toContain("username");
    expect(keys).not.toContain("password");
    const { revealSecretField } = await gw.gql(SecretRevealDocument, {
      fieldKey: "password",
      id: VPN,
    });
    expect(revealSecretField).toBe(secret(VPN)?.fields.password);
    expect(
      await refusal(gw.gql(SecretRevealDocument, { fieldKey: "username", id: VPN })).then(
        (r) => r.code,
      ),
    ).toBe("INVALID_ARGUMENT");
  });

  it("adds the parsed certificate details to a certificate's fields", async () => {
    const gw = await as(ALICE);
    const { secretFields } = await gw.gql(SecretFieldsDocument, { id: CERT });
    const f = Object.fromEntries(secretFields.map((x) => [x.key, x.value]));
    expect(f.subject).toBe("CN=portal.example.org");
    expect(f.sans).toBe("portal.example.org");
    expect(f.hasPrivateKey).toBe("true");
    expect(f.fingerprintSha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(f.privateKey).toBeUndefined();
  });

  it("asks for a fresh second factor before a super-sensitive reveal", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(SecretRevealDocument, { fieldKey: "privateKey", id: CERT })),
    ).toEqual({ code: "FAILED_PRECONDITION", reason: "STEP_UP_REQUIRED" });
    expect(await stepUp(gw, { code: "123456", kind: "totp" })).toBe("ok");
    const { revealSecretField } = await gw.gql(SecretRevealDocument, {
      fieldKey: "privateKey",
      id: CERT,
    });
    expect(revealSecretField).toBe(secret(CERT)?.fields.privateKey);
  });

  it("won't reveal anything from a retired secret", async () => {
    const gw = await as(ALICE);
    await gw.gql(SecretRetireDocument, { id: DB });
    expect(await refusal(gw.gql(SecretRevealDocument, { fieldKey: "password", id: DB }))).toEqual({
      code: "FAILED_PRECONDITION",
      reason: "RETIRED",
    });
  });

  it("shows a locked secret as unreadable and refuses its values with NO_ACCESS", async () => {
    const gw = await as(BOB);
    const id = "mock-secret-helpdesk";
    expect(await gw.gql(SecretDetailDocument, { id }).then((r) => r.secret?.canRead)).toBe(false);
    expect(
      await gw.gql(SecretAccessDocument, { secretId: id }).then((r) => r.mySecretAccess.read),
    ).toBe(false);
    const locked = { code: "PERMISSION_DENIED", reason: "NO_ACCESS" };
    expect(await refusal(gw.gql(SecretFieldsDocument, { id }))).toEqual(locked);
    expect(await refusal(gw.gql(SecretRevealDocument, { fieldKey: "password", id }))).toEqual(
      locked,
    );
    expect(await gw.gql(SecretDetailDocument, { id: DB }).then((r) => r.secret?.canRead)).toBe(
      true,
    );
  });

  it("lists the history newest first, and reveals an old value to the recovery role only", async () => {
    const gw = await as(ALICE);
    const { secretVersions } = await gw.gql(SecretVersionsDocument, { secretId: DB });
    expect(secretVersions.map((v) => v.versionNo)).toEqual([3, 2, 1]);
    expect(secretVersions[0]?.active).toBe(true);
    const old = { fieldKey: "password", secretId: DB, versionNo: 2 };
    expect(await refusal(gw.gql(SecretRevealVersionDocument, old))).toEqual({
      code: "PERMISSION_DENIED",
      reason: "RECOVERY_ROLE_REQUIRED",
    });
    userById(ALICE)?.roles.push("recovery");
    expect(await refusal(gw.gql(SecretRevealVersionDocument, old))).toEqual({
      code: "FAILED_PRECONDITION",
      reason: "STEP_UP_REQUIRED",
    });
    await stepUp(gw, { code: "123456", kind: "totp" });
    const { revealSecretVersionField } = await gw.gql(SecretRevealVersionDocument, old);
    expect(revealSecretVersionField).toMatch(/^mock-/);
    expect(revealSecretVersionField).not.toBe(secret(DB)?.fields.password);
    const current = await gw.gql(SecretRevealVersionDocument, { ...old, versionNo: 3 });
    expect(current.revealSecretVersionField).toBe(secret(DB)?.fields.password);
  });

  it("breaks glass with a reason and a good code, and refuses a wrong code", async () => {
    const gw = await as(ALICE);
    const wrong = await refusal(
      gw.gql(SecretBreakGlassDocument, { code: "000000", reason: "outage", secretId: VPN }),
    );
    expect(wrong.code).toBe("UNAUTHENTICATED");
    const { breakGlassSecret } = await gw.gql(SecretBreakGlassDocument, {
      code: "123456",
      reason: "outage",
      secretId: VPN,
    });
    const f = Object.fromEntries(breakGlassSecret.map((x) => [x.key, x.value]));
    expect(f.password).toBe(secret(VPN)?.fields.password);

    const bob = await as(BOB);
    expect(
      await refusal(
        bob.gql(SecretBreakGlassDocument, {
          code: "123456",
          reason: "x",
          secretId: "mock-secret-helpdesk",
        }),
      ).then((r) => r.code),
    ).toBe("PERMISSION_DENIED");
  });

  it("rotates a credential to a new value and a new version, but not while it's checked out", async () => {
    const gw = await as(ALICE);
    const before = secret(DB)?.fields.password;
    await gw.gql(SecretRotateDocument, { secretId: DB });
    expect(secret(DB)?.fields.password).not.toBe(before);
    expect(secret(DB)?.versions[0]).toMatchObject({ active: true, versionNo: 4 });
    expect(secret(DB)?.lastRotationResult).toBe("ok");

    expect(await refusal(gw.gql(SecretRotateDocument, { secretId: VPN }))).toEqual({
      code: "FAILED_PRECONDITION",
      reason: "CHECKOUT_LEASE_HELD",
    });
    secret(DB)!.rotationOptOut = true;
    expect(await refusal(gw.gql(SecretRotateDocument, { secretId: DB }))).toEqual({
      code: "FAILED_PRECONDITION",
      reason: "ROTATION_OPTED_OUT",
    });
  });

  it("changes automation and token approval for the folder's owners only", async () => {
    const gw = await as(ALICE);
    const a = await gw.gql(SecretSetAutomationDocument, {
      disableHeartbeat: true,
      disableRotation: false,
      secretId: DB,
    });
    expect(a.setSecretAutomation.heartbeatOptOut).toBe(true);
    const t = await gw.gql(SecretSetTokenApprovalDocument, { required: true, secretId: DB });
    expect(t.setSecretTokenApproval.requireTokenApproval).toBe(true);

    const bob = await as(BOB);
    expect(
      await refusal(bob.gql(SecretSetTokenApprovalDocument, { required: false, secretId: DB })),
    ).toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("retires, restores and deletes", async () => {
    const gw = await as(ALICE);
    expect(await gw.gql(SecretRetireDocument, { id: DB }).then((r) => r.retireSecret.retired)).toBe(
      true,
    );
    expect(secret(DB)?.retiredAt).not.toBe("");
    expect(
      await gw.gql(SecretRestoreDocument, { id: DB }).then((r) => r.restoreSecret.retired),
    ).toBe(false);
    expect(await gw.gql(SecretDeleteDocument, { id: DB }).then((r) => r.deleteSecret)).toBe(true);
    expect(secret(DB)).toBeUndefined();
  });

  it("exports a certificate, refusing a keyed container without a passphrase", async () => {
    const gw = await as(ALICE);
    const pem = await gw.gql(SecretExportCertificateDocument, {
      format: "pem-fullchain",
      secretId: CERT,
    });
    expect(pem.exportCertificate.filename).toBe("portal.example.org.pem");
    expect(Buffer.from(pem.exportCertificate.fileBase64, "base64").toString()).toContain("mock");
    expect(
      await refusal(gw.gql(SecretExportCertificateDocument, { format: "pkcs12", secretId: CERT })),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
    const p12 = await gw.gql(SecretExportCertificateDocument, {
      format: "pkcs12",
      newPassphrase: "mock-passphrase",
      secretId: CERT,
    });
    expect(p12.exportCertificate.filename).toBe("portal.example.org.p12");
  });

  it("replaces a certificate in place as a new version", async () => {
    const gw = await as(ALICE);
    const r = await gw.gql(SecretReplaceCertificateDocument, {
      fileBase64: b64("mock certificate for portal.example.org, reissued"),
      secretId: CERT,
    });
    expect(r.replaceCertificate.secret?.id).toBe(CERT);
    expect(r.replaceCertificate.meta?.subject).toBe("CN=portal.example.org");
    expect(Date.parse(r.replaceCertificate.meta?.notAfter ?? "")).toBeGreaterThan(
      Date.now() + 300 * 86_400_000,
    );
    expect(secret(CERT)?.versions[0]).toMatchObject({ active: true, versionNo: 2 });
    expect(
      await refusal(gw.gql(SecretReplaceCertificateDocument, { fileBase64: "", secretId: CERT })),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("refuses an old value of a locked secret even to the recovery role with a fresh MFA", async () => {
    const gw = await as(BOB);
    userById(BOB)?.roles.push("recovery");
    await stepUp(gw, { code: "123456", kind: "totp" });
    expect(
      await refusal(
        gw.gql(SecretRevealVersionDocument, {
          fieldKey: "password",
          secretId: "mock-secret-helpdesk",
          versionNo: 1,
        }),
      ),
    ).toEqual({ code: "PERMISSION_DENIED", reason: "NO_ACCESS" });
  });

  it("lets the lease holder read and reveal a locked secret, and nobody else", async () => {
    const id = "mock-secret-helpdesk";
    world().leases.push({
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      id: "mock-lease-helpdesk-bob",
      issuedAt: new Date().toISOString(),
      returned: false,
      secretId: id,
      userId: BOB,
    });
    const bob = await as(BOB);
    expect(await bob.gql(SecretAccessDocument, { secretId: id })).toMatchObject({
      mySecretAccess: { read: true, reveal: true },
    });
    expect(await bob.gql(SecretDetailDocument, { id })).toMatchObject({
      secret: { canRead: true },
    });
    const { revealSecretField } = await bob.gql(SecretRevealDocument, { fieldKey: "password", id });
    expect(revealSecretField).toBe(secret(id)?.fields.password);

    const dave = await as("mock-user-dave");
    expect(await dave.gql(SecretAccessDocument, { secretId: id })).toMatchObject({
      mySecretAccess: { read: false },
    });
    expect(await refusal(dave.gql(SecretRevealDocument, { fieldKey: "password", id }))).toEqual({
      code: "PERMISSION_DENIED",
      reason: "NO_ACCESS",
    });
  });
});

const stepUpFolder = (id: string) => world().folders.find((f) => f.id === id)!;
const revealPassword = (gw: GatewayClient) =>
  gw.gql(SecretRevealDocument, { fieldKey: "password", id: DB });
const STEP_UP = { code: "FAILED_PRECONDITION", reason: "STEP_UP_REQUIRED" };
const revealedPassword = async (gw: GatewayClient) => {
  const { revealSecretField } = await revealPassword(gw);
  return revealSecretField;
};

// The vault's rule: the nearest folder that sets require or off wins, else the global setting.
describe("reveal step-up in the mock gateway", () => {
  it("reveals without a step-up while neither the setting nor a folder asks for one", async () => {
    const gw = await as(ALICE);
    expect(await revealedPassword(gw)).toBe("mock-Tongue-Eyelet-91");
  });

  it("asks for a step-up everywhere when the global setting is on", async () => {
    settings.security.requireMfaForReveal = true;
    const gw = await as(ALICE);
    expect(await refusal(revealPassword(gw))).toEqual(STEP_UP);
    expect(await stepUp(gw, { code: "123456", kind: "totp" })).toBe("ok");
    expect(await revealedPassword(gw)).toBe("mock-Tongue-Eyelet-91");
  });

  it("lets a folder above turn the global setting off, inherited down the tree", async () => {
    settings.security.requireMfaForReveal = true;
    stepUpFolder("mock-folder-platform").revealStepUp = "off";
    const gw = await as(ALICE);
    expect(await revealedPassword(gw)).toBe("mock-Tongue-Eyelet-91");
  });

  it("lets a folder above require it while the global setting is off", async () => {
    stepUpFolder("mock-folder-platform").revealStepUp = "require";
    const gw = await as(ALICE);
    expect(await refusal(revealPassword(gw))).toEqual(STEP_UP);
  });

  it("applies a site admin's folder toggle to the next reveal, and refuses anyone else's", async () => {
    const bob = await as(BOB);
    expect(
      await refusal(
        bob.gql(AdminSetFolderRevealStepUpDocument, {
          folderId: "mock-folder-databases",
          mode: "require",
        }),
      ),
    ).toMatchObject({ code: "PERMISSION_DENIED" });
    const carol = await as("mock-user-carol");
    await carol.gql(AdminSetFolderRevealStepUpDocument, {
      folderId: "mock-folder-databases",
      mode: "require",
    });
    expect(await refusal(revealPassword(await as(ALICE)))).toEqual(STEP_UP);
  });

  it("takes the nearest folder that sets one", async () => {
    stepUpFolder("mock-folder-platform").revealStepUp = "require";
    stepUpFolder("mock-folder-databases").revealStepUp = "off";
    const gw = await as(ALICE);
    expect(await revealedPassword(gw)).toBe("mock-Tongue-Eyelet-91");
  });

  it("reveals a super-sensitive field without a step-up where none applies", async () => {
    stepUpFolder("mock-folder-certificates").revealStepUp = undefined;
    const gw = await as(ALICE);
    const { revealSecretField } = await gw.gql(SecretRevealDocument, {
      fieldKey: "privateKey",
      id: CERT,
    });
    expect(revealSecretField).toBe(secret(CERT)?.fields.privateKey);
  });

  describe("approval levels", () => {
    const ssh = "mock-secret-build-ssh";

    it("lets owners reveal an approval-required secret and holds everyone else", async () => {
      const alice = await as(ALICE);
      const own = await alice.gql(SecretRevealDocument, { fieldKey: "passphrase", id: ssh });
      expect(own.revealSecretField).toBe(secret(ssh)?.fields.passphrase);
      const bob = await as(BOB);
      const held = await bob
        .gql(SecretRevealDocument, { fieldKey: "passphrase", id: ssh })
        .catch((error: unknown) => error as GraphQLRequestError);
      expect(held).toMatchObject({ code: "FAILED_PRECONDITION", reason: "APPROVAL_REQUIRED" });
    });

    it("holds an owner's reveal of an always-approve secret too", async () => {
      secret(ssh)!.alwaysRequireApproval = true;
      const alice = await as(ALICE);
      const held = await alice
        .gql(SecretRevealDocument, { fieldKey: "passphrase", id: ssh })
        .catch((error: unknown) => error as GraphQLRequestError);
      expect(held).toMatchObject({ reason: "APPROVAL_REQUIRED" });
    });

    it("releases a held web reveal once another owner approves it", async () => {
      const bob = await as(BOB);
      const { prepareSecretReveal: u } = await bob.gql(SecretPrepareRevealDocument, {
        fieldKey: "passphrase",
        runId: "web_mock",
        secretId: ssh,
      });
      expect(u).toMatchObject({ confirm: false, state: "PENDING" });
      const early = await bob
        .gql(SecretRedeemRevealDocument, { id: u.id })
        .catch((error: unknown) => error as GraphQLRequestError);
      expect(early).toMatchObject({ code: "FAILED_PRECONDITION" });
      const carol = await as("mock-user-carol");
      await carol.gql(AgentsDecideUseDocument, {
        approve: true,
        factor: { code: "123456", kind: "totp" },
        id: u.id,
      });
      const { redeemSecretReveal } = await bob.gql(SecretRedeemRevealDocument, { id: u.id });
      expect(redeemSecretReveal).toBe(secret(ssh)?.fields.passphrase);
    });
  });
});
