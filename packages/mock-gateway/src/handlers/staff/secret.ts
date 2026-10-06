import type { RequestHandler } from "msw";

import {
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
  SecretRestoreVersionDocument,
  SecretRetireDocument,
  SecretRevealDocument,
  SecretRevealVersionDocument,
  SecretRotateDocument,
  SecretSetAutomationDocument,
  SecretSetTokenApprovalDocument,
  SecretVersionsDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";
import { createHash } from "node:crypto";

import type {
  MockFolder,
  MockSecret,
  MockSecretType,
  MockSecretUse,
  MockVersion,
} from "#mock/fixtures/world";

import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById, WRONG_CODE } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { revealStepUpRequired } from "#mock/handlers/revealStepUp";
import {
  activeLease,
  canApprove,
  canRead,
  canSee,
  chain,
  secretById,
} from "#mock/handlers/staff/access";
import { confirmMode, needsApproval, runConfirmed } from "#mock/handlers/staff/approval";
import {
  breakGlassClosed,
  liveBreakGlass,
  recordBreakGlassReveal,
} from "#mock/handlers/staff/breakGlass";
import { freshMfa, stepUpRequired } from "#mock/handlers/stepUp";
import { mockState, onMockReset } from "#mock/state";

const DAY = 86_400_000;
// The vault's windows: a pending use waits 10 minutes; an approved one is redeemed within one.
const PENDING_USE_S = 600;
const REDEEM_AFTER_APPROVAL_S = 60;

/** The vault's refusal of a direct reveal the secret's approval level holds for a decision. */
const approvalRequired = () =>
  refusal(
    "FAILED_PRECONDITION",
    "this secret needs an owner's or approver's approval for each reveal; prepare a reveal use",
    "APPROVAL_REQUIRED",
  );
const RECOVERY_ROLE = "recovery";

/** The personal-folder owner the vault alerts on a break-glass reveal, if the secret has one. */
const personalOwnerOf = (s: MockSecret): string | undefined =>
  chain(s.folderId).find((f) => f.scope === "personal")?.ownerUserId;

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;
const world = () => mockState.world;

const typeOf = (s: MockSecret): MockSecretType | undefined =>
  world().secretTypes.find((t) => t.id === s.typeId);

/** The folders a person may see: shared ones, and their own personal ones. */
const folderVisible = (userId: string, f: MockFolder) =>
  f.scope !== "personal" || f.ownerUserId === userId;

const isSensitive = (t: MockSecretType | undefined, key: string) => {
  const definition = t?.fields.find((f) => f.key === key);
  return (
    !!definition &&
    (definition.kind === "password" || !!definition.sensitive || !!definition.superSensitive)
  );
};

const hex = (text: string, bytes: number) =>
  createHash("sha256")
    .update(text)
    .digest("hex")
    .slice(0, bytes * 2)
    .toUpperCase()
    .replaceAll(/(..)(?!$)/g, "$1:");

/**
 * What the vault parses out of a stored certificate, kept as plain fields. The mock can't
 * parse its invented certificates, so it derives stable details from the secret.
 */
const certMeta = (s: MockSecret): Record<string, string> => {
  const f = s.fields;
  const notAfter = f.notAfter ?? s.expiresAt ?? "";
  const cn = /CN=([^,]+)/.exec(f.subject ?? "")?.[1] ?? s.name;
  return {
    fingerprintSha256: f.fingerprintSha256 ?? hex(`${s.id}:${f.certificate ?? ""}`, 32),
    hasPrivateKey: String(!!f.privateKey),
    isCA: f.isCA ?? "false",
    keyAlgorithm: f.keyAlgorithm ?? "ECDSA",
    keyBits: f.keyBits ?? "256",
    notAfter,
    notBefore:
      f.notBefore ?? (notAfter ? new Date(Date.parse(notAfter) - 365 * DAY).toISOString() : ""),
    sans: f.sans ?? cn,
    serialNumber: f.serialNumber ?? hex(`${s.id}:serial`, 8),
  };
};

const view = (s: MockSecret, userId: string) => ({
  alwaysRequireApproval: !!s.alwaysRequireApproval,
  canRead: canRead(userId, s),
  expiresAt: s.expiresAt ?? null,
  folderId: s.folderId,
  heartbeatOptOut: s.heartbeatOptOut,
  id: s.id,
  lastAccessedAt: s.lastAccessedAt ?? null,
  lastHeartbeatResult: s.lastHeartbeatResult ?? null,
  lastRotationResult: s.lastRotationResult ?? null,
  name: s.name,
  nextRotationAt: s.nextRotationAt ?? null,
  requireTokenApproval: s.requireTokenApproval,
  retired: s.retired,
  retiredAt: s.retiredAt,
  rotatedAt: s.rotatedAt ?? null,
  rotationIntervalDays: s.rotationIntervalDays ?? null,
  rotationOptOut: s.rotationOptOut,
  targetId: s.targetId ?? null,
  typeId: s.typeId,
  verifiedAt: s.verifiedAt ?? null,
  viewCount: s.viewCount,
});

const notFound = () => refusal("NOT_FOUND", "secret not found");
const noRead = (what: string) =>
  refusal("PERMISSION_DENIED", `not permitted to ${what} this secret`, "NO_ACCESS");
const notAllowed = (what: string) =>
  refusal("PERMISSION_DENIED", `not permitted to ${what} this secret`);
const retired = () => refusal("FAILED_PRECONDITION", "secret is retired", "RETIRED");

/** Run `work` on a secret the user can see, answering as the vault does when they can't. */
const withSecret = (
  request: Request,
  id: string,
  work: (s: MockSecret, userId: string) => unknown,
): never =>
  asUser(request, (userId) => {
    const s = secretById(id);
    if (!s || !canSee(userId, s)) return notFound();
    return work(s, userId) as never;
  });

const bumpVersion = (s: MockSecret, userId: string, changedFieldKeys: string[]) => {
  const versionNo = Math.max(0, ...s.versions.map((v) => v.versionNo)) + 1;
  for (const v of s.versions) v.active = false;
  s.versions.unshift({
    active: true,
    changedFieldKeys,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    createdByName: userById(userId)?.name ?? userId,
    fieldKeys: Object.keys(s.fields),
    versionNo,
  });
};

/**
 * The values a version held when it was replaced, by secret and version number. The seeded
 * history has no stored values, so a version without an entry gets invented ones.
 */
let held = new Map<string, Map<number, Record<string, string>>>();
onMockReset(() => {
  held = new Map();
});

/** Keep the active version's values before they change, so the history can give them back. */
const remember = (s: MockSecret) => {
  const active = s.versions.find((v) => v.active);
  if (!active) return;
  const bySecret = held.get(s.id) ?? new Map<number, Record<string, string>>();
  bySecret.set(active.versionNo, { ...s.fields });
  held.set(s.id, bySecret);
};

const valueAt = (s: MockSecret, v: MockVersion, key: string): string | undefined => {
  if (v.active) return s.fields[key];
  const kept = held.get(s.id)?.get(v.versionNo);
  if (kept) return kept[key];
  return `mock-v${v.versionNo}-${key}-${hex(`${s.id}:${v.versionNo}`, 3).replaceAll(":", "")}`;
};

const freshValue = () => `mock-Rotated-${Math.random().toString(36).slice(2, 10)}`;

const EXPORTS: Record<string, { contentType: string; ext: string; key?: boolean; pass?: boolean }> =
  {
    der: { contentType: "application/pkix-cert", ext: "der" },
    jks: { contentType: "application/x-java-keystore", ext: "jks", key: true, pass: true },
    pem: { contentType: "application/x-pem-file", ext: "pem", key: true },
    "pem-cert": { contentType: "application/x-pem-file", ext: "crt" },
    "pem-fullchain": { contentType: "application/x-pem-file", ext: "pem" },
    "pem-key": { contentType: "application/x-pem-file", ext: "key", key: true },
    pkcs12: { contentType: "application/x-pkcs12", ext: "p12", key: true, pass: true },
    pkcs7: { contentType: "application/x-pkcs7-certificates", ext: "p7b" },
  };

/** Mock answers for secret detail: fields, reveal, break glass, history, rotation and certificates (S3). */
export const secretHandlers: RequestHandler[] = [
  api.query(SecretDetailDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      return ok({
        folders: world()
          .folders.filter((f) => folderVisible(userId, f))
          .map(({ id, name, parentId, scope }) => ({
            id,
            name,
            parentId: parentId ?? null,
            scope,
          })),
        secret: s && canSee(userId, s) ? view(s, userId) : null,
        secretTypes: world().secretTypes.map((t) => ({
          checkout: t.checkout ?? null,
          fields: t.fields.map((f) => ({
            key: f.key,
            kind: f.kind,
            label: f.label,
            options: f.options ?? null,
            rotates: f.rotates ?? null,
            sensitive: f.sensitive ?? null,
            superSensitive: f.superSensitive ?? null,
          })),
          heartbeat: t.heartbeat ?? null,
          id: t.id,
          name: t.name,
          origin: t.origin,
          rotation: t.rotation ?? null,
          vendor: t.vendor ?? null,
        })),
        targets: world().targets.map(({ hostname, id, name }) => ({ hostname, id, name })),
      });
    }),
  ),

  api.query(SecretAccessDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      const read = canRead(userId, s);
      const manage = canApprove(userId, s);
      return ok({
        mySecretAccess: { approve: manage, informed: true, manage, read, reveal: read },
      });
    }),
  ),

  api.query(SecretFieldsDocument, ({ request, variables }) =>
    withSecret(request, variables.id, (s, userId) => {
      if (!canRead(userId, s)) return noRead("read");
      const t = typeOf(s);
      const values = { ...s.fields, ...(s.typeId === "type-ssl-cert" ? certMeta(s) : {}) };
      return ok({
        secretFields: Object.entries(values)
          .filter(([key]) => !isSensitive(t, key))
          .map(([key, value]) => ({ key, value })),
      });
    }),
  ),

  api.query(SecretVersionsDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (!canRead(userId, s)) return noRead("read");
      return ok({ secretVersions: s.versions.map((v) => ({ ...v })) });
    }),
  ),

  api.mutation(SecretRevealDocument, ({ request, variables }) =>
    withSecret(request, variables.id, (s, userId) => {
      if (s.retired) return retired();
      const t = typeOf(s);
      if (!isSensitive(t, variables.fieldKey))
        return refusal("INVALID_ARGUMENT", "field is not sensitive");
      if (!canRead(userId, s)) return noRead("reveal");
      if (needsApproval(userId, s)) return approvalRequired();
      if (revealStepUpRequired(s.folderId) && !freshMfa(request))
        return HttpResponse.json({ errors: [stepUpRequired()] }) as never;
      const value = s.fields[variables.fieldKey];
      if (value === undefined) return refusal("NOT_FOUND", "field not found");
      s.viewCount += 1;
      s.lastAccessedAt = new Date().toISOString();
      return ok({ revealSecretField: value });
    }),
  ),

  api.mutation(SecretPrepareRevealDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (s.retired) return retired();
      if (!isSensitive(typeOf(s), variables.fieldKey))
        return refusal("NOT_FOUND", "secret field not found");
      if (!canRead(userId, s)) return noRead("reveal");
      const now = Math.floor(Date.now() / 1000);
      const needs = needsApproval(userId, s);
      const mode = needs ? confirmMode(userId, s) : false;
      if (mode === null)
        return refusal(
          "FAILED_PRECONDITION",
          "nobody can approve this use: the secret has no active owner or approver",
          "NO_APPROVER",
        );
      const u: MockSecretUse = {
        argv: [],
        clientLabel: "Sneakers web",
        confirm: mode,
        expiresAtUnix: now + PENDING_USE_S,
        fieldKey: variables.fieldKey,
        id: `mock-use-web-${world().secretUses.length + 1}`,
        ownerUserId: userId,
        reveal: true,
        runId: variables.runId ?? undefined,
        secretId: s.id,
        secretName: s.name,
        state: "pending",
      };
      if (!needs || (mode && runConfirmed(u, now))) {
        u.state = "approved";
        u.expiresAtUnix = now + REDEEM_AFTER_APPROVAL_S;
      }
      world().secretUses.push(u);
      return ok({
        prepareSecretReveal: {
          confirm: u.confirm,
          expiresAtUnix: u.expiresAtUnix,
          id: u.id,
          runId: u.runId ?? null,
          state: u.state.toUpperCase(),
        },
      });
    }),
  ),

  api.mutation(SecretRedeemRevealDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const u = world().secretUses.find((x) => x.id === variables.id);
      if (!u || u.ownerUserId !== userId || u.tokenId)
        return refusal("PERMISSION_DENIED", "only the person that prepared this use can redeem it");
      if (u.state === "approved" && Math.floor(Date.now() / 1000) >= u.expiresAtUnix)
        u.state = "expired";
      if (u.state !== "approved")
        return refusal(
          "FAILED_PRECONDITION",
          `secret use is SECRET_USE_STATE_${u.state.toUpperCase()}`,
        );
      const s = secretById(u.secretId);
      if (!s || !canRead(userId, s)) return noRead("reveal");
      if (revealStepUpRequired(s.folderId) && !freshMfa(request))
        return HttpResponse.json({ errors: [stepUpRequired()] }) as never;
      u.state = "redeemed";
      s.viewCount += 1;
      s.lastAccessedAt = new Date().toISOString();
      return ok({ redeemSecretReveal: s.fields[u.fieldKey] ?? "" });
    }),
  ),

  api.mutation(SecretRevealVersionDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!userById(userId)?.roles.includes(RECOVERY_ROLE))
        return refusal(
          "PERMISSION_DENIED",
          "this needs the recovery role",
          "RECOVERY_ROLE_REQUIRED",
        );
      if (!freshMfa(request)) return HttpResponse.json({ errors: [stepUpRequired()] }) as never;
      const s = secretById(variables.secretId);
      if (!s || !canSee(userId, s)) return notFound();
      if (s.retired) return retired();
      if (!canRead(userId, s)) return noRead("reveal");
      const v = s.versions.find((x) => x.versionNo === variables.versionNo);
      if (!v?.fieldKeys.includes(variables.fieldKey))
        return refusal("NOT_FOUND", "field not found");
      return ok({ revealSecretVersionField: valueAt(s, v, variables.fieldKey) ?? "" });
    }),
  ),

  // The gateway refuses while a lease is held before it asks the vault, which then wants the
  // recovery role, a fresh MFA, read access and no rotation under way.
  api.mutation(SecretRestoreVersionDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      const lease = activeLease(s.id);
      if (lease)
        return refusal(
          "FAILED_PRECONDITION",
          "cannot restore a version while the secret is checked out",
          "CHECKOUT_LEASE_HELD",
          { holder_user_id: lease.userId },
        );
      if (!userById(userId)?.roles.includes(RECOVERY_ROLE))
        return refusal(
          "PERMISSION_DENIED",
          "this needs the recovery role",
          "RECOVERY_ROLE_REQUIRED",
        );
      if (!freshMfa(request)) return HttpResponse.json({ errors: [stepUpRequired()] }) as never;
      if (s.retired) return retired();
      if (!canRead(userId, s)) return noRead("restore");
      if (s.lastRotationResult === "rotating")
        return refusal(
          "FAILED_PRECONDITION",
          "a rotation of this secret is queued or running; try again once it finishes",
          "ROTATION_IN_PROGRESS",
        );
      const v = s.versions.find((x) => x.versionNo === variables.versionNo);
      if (!v) return refusal("NOT_FOUND", "secret version not found");
      if (v.active)
        return refusal("FAILED_PRECONDITION", "that version is already the current one");
      const restored = Object.fromEntries(v.fieldKeys.map((k) => [k, valueAt(s, v, k) ?? ""]));
      const changed = [...new Set([...Object.keys(s.fields), ...v.fieldKeys])].filter(
        (k) => s.fields[k] !== restored[k],
      );
      remember(s);
      s.fields = restored;
      if (s.targetId) s.lastHeartbeatResult = "unknown";
      bumpVersion(s, userId, changed);
      return ok({ restoreSecretVersion: view(s, userId) });
    }),
  ),

  api.mutation(SecretBreakGlassDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      // The gateway checks the code before the vault sees the call.
      const sessionId = variables.sessionId ?? null;
      // In break-glass mode the gateway checks the caller and the session before the code.
      if (sessionId && !isSiteAdmin(userId))
        return refusal(
          "PERMISSION_DENIED",
          "break-glass is for site admins",
          "BREAK_GLASS_NOT_ADMIN",
        );
      if (!/^\d{6}$/.test(variables.code) || variables.code === WRONG_CODE)
        return refusal("UNAUTHENTICATED", "invalid or missing MFA code");
      const session = sessionId ? liveBreakGlass(request, userId, sessionId) : undefined;
      if (sessionId && !session) return breakGlassClosed();
      const s = secretById(variables.secretId);
      // A site admin reads every secret in the vault, other people's personal ones included.
      if (!s || (!session && !canSee(userId, s))) return notFound();
      if (s.retired) return retired();
      if (!session && !canRead(userId, s)) return notAllowed("break glass on");
      if (session) recordBreakGlassReveal(session, s.id, !!personalOwnerOf(s));
      s.viewCount += 1;
      return ok({
        breakGlassSecret: Object.entries(s.fields).map(([key, value]) => ({ key, value })),
      });
    }),
  ),

  api.mutation(SecretRotateDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      const held = activeLease(s.id);
      if (held)
        return refusal(
          "FAILED_PRECONDITION",
          "cannot rotate while the secret is checked out",
          "CHECKOUT_LEASE_HELD",
        );
      if (!canApprove(userId, s)) return notAllowed("rotate");
      if (s.retired) return retired();
      const t = typeOf(s);
      if (!t?.rotation)
        return refusal("FAILED_PRECONDITION", "this type can't rotate", "ROTATION_NOT_SUPPORTED");
      if (s.rotationOptOut)
        return refusal(
          "FAILED_PRECONDITION",
          "this secret is opted out of rotation",
          "ROTATION_OPTED_OUT",
        );
      const keys = t.fields.filter((f) => f.rotates).map((f) => f.key);
      remember(s);
      for (const key of keys) s.fields[key] = freshValue();
      const now = Date.now();
      s.rotatedAt = new Date(now).toISOString();
      s.lastRotationResult = "ok";
      if (s.rotationIntervalDays)
        s.nextRotationAt = new Date(now + s.rotationIntervalDays * DAY).toISOString();
      bumpVersion(s, userId, keys);
      return ok({ rotateSecret: true });
    }),
  ),

  api.mutation(SecretSetAutomationDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("change");
      s.rotationOptOut = variables.disableRotation;
      s.heartbeatOptOut = variables.disableHeartbeat;
      return ok({ setSecretAutomation: view(s, userId) });
    }),
  ),

  api.mutation(SecretSetTokenApprovalDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("change");
      s.requireTokenApproval = variables.required;
      s.alwaysRequireApproval = variables.required && !!variables.always;
      return ok({ setSecretTokenApproval: view(s, userId) });
    }),
  ),

  api.mutation(SecretRetireDocument, ({ request, variables }) =>
    withSecret(request, variables.id, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("retire");
      s.retired = true;
      s.retiredAt = new Date().toISOString();
      return ok({ retireSecret: view(s, userId) });
    }),
  ),

  api.mutation(SecretRestoreDocument, ({ request, variables }) =>
    withSecret(request, variables.id, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("restore");
      s.retired = false;
      s.retiredAt = "";
      return ok({ restoreSecret: view(s, userId) });
    }),
  ),

  api.mutation(SecretDeleteDocument, ({ request, variables }) =>
    withSecret(request, variables.id, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("delete");
      world().secrets = world().secrets.filter((x) => x.id !== s.id);
      return ok({ deleteSecret: true });
    }),
  ),

  api.mutation(SecretExportCertificateDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (!canRead(userId, s)) return noRead("export");
      if (s.retired) return retired();
      if (s.typeId !== "type-ssl-cert")
        return refusal("INVALID_ARGUMENT", "not a certificate secret");
      const format = EXPORTS[variables.format];
      if (!format) return refusal("INVALID_ARGUMENT", "unsupported export format");
      if (format.key && !s.fields.privateKey)
        return refusal("INVALID_ARGUMENT", "this certificate has no private key on file");
      if (format.pass && !variables.newPassphrase)
        return refusal("INVALID_ARGUMENT", "passphrase required for this format");
      const body = `mock ${variables.format} export of ${s.name}, not a real certificate\n`;
      return ok({
        exportCertificate: {
          contentType: format.contentType,
          fileBase64: Buffer.from(body).toString("base64"),
          filename: `${s.name}.${format.ext}`,
        },
      });
    }),
  ),

  api.mutation(SecretReplaceCertificateDocument, ({ request, variables }) =>
    withSecret(request, variables.secretId, (s, userId) => {
      if (!canApprove(userId, s)) return notAllowed("replace");
      if (s.retired) return retired();
      const text = Buffer.from(variables.fileBase64, "base64").toString();
      if (!text.trim()) return refusal("INVALID_ARGUMENT", "unrecognized format");
      const now = Date.now();
      const notAfter = new Date(now + 365 * DAY).toISOString();
      remember(s);
      Object.assign(s.fields, {
        certificate: text,
        fingerprintSha256: hex(`${s.id}:${text}`, 32),
        notAfter,
        notBefore: new Date(now).toISOString(),
        serialNumber: hex(`${s.id}:${text}:serial`, 8),
      });
      s.expiresAt = notAfter;
      bumpVersion(s, userId, ["certificate"]);
      const meta = certMeta(s);
      return ok({
        replaceCertificate: {
          aliases: [],
          meta: {
            ...meta,
            hasPrivateKey: meta.hasPrivateKey === "true",
            isCA: meta.isCA === "true",
            issuer: s.fields.issuer ?? "",
            keyBits: Number(meta.keyBits),
            sans: (meta.sans ?? "").split(",").filter(Boolean),
            subject: s.fields.subject ?? "",
          },
          secret: view(s, userId),
        },
      });
    }),
  ),
];
