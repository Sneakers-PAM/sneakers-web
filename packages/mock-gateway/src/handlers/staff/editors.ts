import type { RequestHandler } from "msw";

import {
  EditorsCreateSecretDocument,
  EditorsGenerateKeyPairDocument,
  EditorsImportCertificateDocument,
  EditorsPickersDocument,
  EditorsSaveTargetDocument,
  EditorsSecretDocument,
  EditorsSecretFieldsDocument,
  EditorsUpdateSecretDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";
import { randomBytes } from "node:crypto";

import type { MockFolder, MockSecret, MockSecretType, MockTarget } from "#mock/fixtures/world";

import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { settings } from "#mock/admin/settings";
import { userById } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { canApprove, canRead, canSee, chain, secretById } from "#mock/handlers/staff/access";
import { mockState, newToken } from "#mock/state";

/*
 * Mock answers for the secret editors, key generation and certificate import (S6). Like the
 * vault, a new secret needs a folder the user manages and an edit needs the secret's
 * approvers; no answer here carries a sensitive value back.
 */

const DAY = 86_400_000;

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;
const world = () => mockState.world;

const folderById = (id: string) => world().folders.find((f) => f.id === id);
const typeById = (id: string) => world().secretTypes.find((t) => t.id === id);

/** Someone else's personal folders don't exist as far as the user can tell. */
const folderVisible = (userId: string, f: MockFolder) =>
  !chain(f.id).some((c) => c.scope === "personal" && c.ownerUserId !== userId);

/**
 * As the vault's isFolderOwner: a site admin or root may add secrets to any folder they can
 * see, others to folders they own or that sit under one they own.
 */
const canManageFolder = (userId: string, f: MockFolder) =>
  folderVisible(userId, f) &&
  (isSiteAdmin(userId) || chain(f.id).some((c) => c.owners.includes(userId)));

const targetVisible = (userId: string, t: MockTarget) => !t.ownerUserId || t.ownerUserId === userId;

const isSensitive = (t: MockSecretType | undefined, key: string) => {
  const d = t?.fields.find((f) => f.key === key);
  return (
    !!d && (d.kind === "password" || d.kind === "sensitive" || !!d.sensitive || !!d.superSensitive)
  );
};

const fieldsOf = (pairs: { key: string; value: string }[] | null | undefined) =>
  Object.fromEntries((pairs ?? []).map((p) => [p.key, p.value]));

// The armor lines are built from parts so the source never holds one whole; secret scanners
// rightly flag those.
const DASHES = "-".repeat(5);
const KEY_LABEL = "OPENSSH PRIVATE KEY";
const armor = (edge: "BEGIN" | "END") => `${DASHES}${edge} ${KEY_LABEL}${DASHES}`;
const OPENSSH_BLOCK = new RegExp(String.raw`${armor("BEGIN")}([\s\S]*?)${armor("END")}`);

/** The public blob inside an OpenSSH private key, and the one on a public key line. */
const SSH_MAGIC = "openssh-key-v1\0";
const readString = (buf: Buffer, at: number): [Buffer, number] | null => {
  if (at + 4 > buf.length) return null;
  const end = at + 4 + buf.readUInt32BE(at);
  return end > buf.length ? null : [buf.subarray(at + 4, end), end];
};
const privateBlob = (text: string): null | string => {
  const m = OPENSSH_BLOCK.exec(text);
  if (!m) return null;
  const buf = Buffer.from((m[1] ?? "").replaceAll(/\s+/g, ""), "base64");
  if (buf.subarray(0, SSH_MAGIC.length).toString("latin1") !== SSH_MAGIC) return null;
  let at = SSH_MAGIC.length;
  for (let index = 0; index < 3; index++) {
    const s = readString(buf, at);
    if (!s) return null;
    at = s[1];
  }
  return readString(buf, at + 4)?.[0].toString("base64") ?? null;
};

/** The vault checks a submitted pair belongs together before it stores anything. */
const keyPairProblem = (fields: Record<string, string>): null | string => {
  const priv = fields.privateKey?.trim();
  const pub = fields.publicKey?.trim();
  if (!priv || !pub) return null;
  const blob = privateBlob(priv);
  if (blob && blob !== pub.split(/\s+/, 2)[1])
    return "the public key does not match the private key";
  return null;
};

const sshString = (bytes: Buffer | string) => {
  const body = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : bytes;
  const n = Buffer.alloc(4);
  n.writeUInt32BE(body.length);
  return Buffer.concat([n, body]);
};

/** The four formats the vault's generator offers. */
const KEY_SHAPES: Record<string, () => { blob: Buffer; type: string }> = {
  "ECDSA P-256": () => ({
    blob: Buffer.concat([
      sshString("ecdsa-sha2-nistp256"),
      sshString("nistp256"),
      sshString(Buffer.concat([Buffer.from([4]), randomBytes(64)])),
    ]),
    type: "ecdsa-sha2-nistp256",
  }),
  Ed25519: () => ({
    blob: Buffer.concat([sshString("ssh-ed25519"), sshString(randomBytes(32))]),
    type: "ssh-ed25519",
  }),
  "RSA 2048": () => ({
    blob: Buffer.concat([
      sshString("ssh-rsa"),
      sshString(Buffer.from([1, 0, 1])),
      sshString(randomBytes(257)),
    ]),
    type: "ssh-rsa",
  }),
  "RSA 4096": () => ({
    blob: Buffer.concat([
      sshString("ssh-rsa"),
      sshString(Buffer.from([1, 0, 1])),
      sshString(randomBytes(513)),
    ]),
    type: "ssh-rsa",
  }),
};

/**
 * A key-shaped pair: an OpenSSH container holding a random public blob and a private section
 * that says it's mock. It parses like a key, so the editor's checks run, but signs nothing.
 */
const mockKeyPair = (format: string) => {
  const shape = KEY_SHAPES[format]?.();
  if (!shape) return null;
  const container = Buffer.concat([
    Buffer.from(SSH_MAGIC, "latin1"),
    sshString("none"),
    sshString("none"),
    sshString(""),
    Buffer.from([0, 0, 0, 1]),
    sshString(shape.blob),
    sshString(`mock private section, not a real key ${randomBytes(8).toString("hex")}`),
  ]);
  const lines = container.toString("base64").match(/.{1,70}/g) ?? [];
  return {
    privateKey: [armor("BEGIN"), ...lines, armor("END"), ""].join("\n"),
    publicKey: `${shape.type} ${shape.blob.toString("base64")} mock@example.org`,
  };
};

const firstVersion = (userId: string, fields: Record<string, string>) => [
  {
    active: true,
    changedFieldKeys: Object.keys(fields),
    createdAt: new Date().toISOString(),
    createdBy: userId,
    createdByName: userById(userId)?.name ?? userId,
    fieldKeys: Object.keys(fields),
    versionNo: 1,
  },
];

const newSecret = (
  userId: string,
  seed: Partial<MockSecret> & Pick<MockSecret, "fields" | "folderId" | "name" | "typeId">,
): MockSecret => {
  const s: MockSecret = {
    canRead: true,
    heartbeatOptOut: false,
    id: newToken("mock-secret"),
    requireTokenApproval: false,
    retired: false,
    retiredAt: "",
    rotationOptOut: false,
    versions: firstVersion(userId, seed.fields),
    viewCount: 0,
    ...seed,
  };
  world().secrets.push(s);
  return s;
};

/** Where a new secret may go, answered the way the vault does when it may not. */
const placeIn = (userId: string, folderId: string): MockFolder | never => {
  const f = folderById(folderId);
  if (!f || !folderVisible(userId, f)) return refusal("NOT_FOUND", "folder not found");
  if (!canManageFolder(userId, f))
    return refusal("PERMISSION_DENIED", "not permitted to create a secret in this folder");
  return f;
};

const isResponse = (v: unknown): v is Response => v instanceof Response;

const policyView = (p: (typeof settings.policies)[number]) => ({
  endLiteral: p.endLiteral ?? null,
  excludeChars: p.excludeChars ?? null,
  id: p.id,
  isDefault: settings.security.defaultPasswordPolicyId === p.id,
  maxLength: p.maxLength ?? null,
  minLength: p.minLength,
  name: p.name,
  requireDigit: p.requireDigit,
  requireLower: p.requireLower,
  requireSymbol: p.requireSymbol,
  requireUpper: p.requireUpper,
  startClass: p.startClass ?? null,
});

const typeView = (t: MockSecretType) => ({
  checkout: t.checkout ?? false,
  fields: t.fields.map((f) => ({
    defaultValue: f.defaultValue ?? null,
    key: f.key,
    kind: f.kind,
    label: f.label,
    maxLength: f.maxLength ?? null,
    options: f.options ?? null,
    pattern: f.pattern ?? null,
    policyEnforcement: f.policyEnforcement ?? null,
    policyId: f.policyId ?? null,
    required: f.required ?? false,
    rotates: f.rotates ?? false,
    sensitive: f.sensitive ?? false,
    superSensitive: f.superSensitive ?? false,
  })),
  heartbeat: t.heartbeat ?? false,
  id: t.id,
  name: t.name,
  origin: t.origin,
  rotation: t.rotation ?? false,
  vendor: t.vendor ?? null,
});

const targetView = (t: MockTarget) => ({
  hostname: t.hostname,
  id: t.id,
  name: t.name,
  ownerUserId: t.ownerUserId ?? null,
});

export const editorsHandlers: RequestHandler[] = [
  api.query(EditorsPickersDocument, ({ request }) =>
    asUser(request, (userId) =>
      ok({
        connections: world().connections.map((c) => ({
          id: c.id,
          name: c.name,
          port: c.port ?? null,
          protocol: c.protocol,
        })),
        folders: world()
          .folders.filter((f) => folderVisible(userId, f))
          .map((f) => ({
            canManage: canManageFolder(userId, f),
            id: f.id,
            name: f.name,
            parentId: f.parentId ?? null,
            scope: f.scope,
          })),
        passwordPolicies: settings.policies.map((p) => policyView(p)),
        secretTypes: world().secretTypes.map((t) => typeView(t)),
        targets: world()
          .targets.filter((t) => targetVisible(userId, t))
          .map((t) => targetView(t)),
      }),
    ),
  ),

  api.query(EditorsSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      return ok({
        secret: {
          expiresAt: s.expiresAt ?? null,
          folderId: s.folderId,
          id: s.id,
          name: s.name,
          targetId: s.targetId ?? null,
          typeId: s.typeId,
        },
      });
    }),
  ),

  api.query(EditorsSecretFieldsDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      if (!canRead(userId, s))
        return refusal("PERMISSION_DENIED", "not permitted to read this secret", "NO_ACCESS");
      const t = typeById(s.typeId);
      return ok({
        secretFields: Object.entries(s.fields)
          .filter(([key]) => !isSensitive(t, key))
          .map(([key, value]) => ({ key, value })),
      });
    }),
  ),

  api.mutation(EditorsCreateSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const input = variables.input;
      if (!input.name.trim() || !input.folderId || !input.typeId)
        return refusal("INVALID_ARGUMENT", "name, folder, and type are required");
      if (!typeById(input.typeId)) return refusal("NOT_FOUND", "secret type not found");
      const folder = placeIn(userId, input.folderId);
      if (isResponse(folder)) return folder as never;
      if (input.targetId && !world().targets.some((t) => t.id === input.targetId))
        return refusal("NOT_FOUND", "target not found");
      const fields = fieldsOf(input.fields);
      const mismatch = keyPairProblem(fields);
      if (mismatch) return refusal("INVALID_ARGUMENT", mismatch);
      const s = newSecret(userId, {
        expiresAt: input.expiresAt || undefined,
        fields,
        folderId: folder.id,
        name: input.name.trim(),
        targetId: input.targetId || undefined,
        typeId: input.typeId,
      });
      return ok({ createSecret: { id: s.id } });
    }),
  ),

  api.mutation(EditorsUpdateSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      if (!canApprove(userId, s))
        return refusal("PERMISSION_DENIED", "not permitted to edit this secret");
      const input = variables.input;
      if (input.folderId && input.folderId !== s.folderId) {
        const destination = placeIn(userId, input.folderId);
        if (isResponse(destination)) return destination as never;
      }
      if (input.targetId && !world().targets.some((t) => t.id === input.targetId))
        return refusal("NOT_FOUND", "target not found");
      const merged = { ...s.fields, ...fieldsOf(input.fields) };
      const mismatch = keyPairProblem(merged);
      if (mismatch) return refusal("INVALID_ARGUMENT", mismatch);
      const changed = [...new Set([...Object.keys(s.fields), ...Object.keys(merged)])].filter(
        (k) => s.fields[k] !== merged[k],
      );
      if (input.name?.trim()) s.name = input.name.trim();
      if (input.folderId) s.folderId = input.folderId;
      // The vault takes the target and expiry as given, so the editor always sends both.
      s.targetId = input.targetId || undefined;
      s.expiresAt = input.expiresAt || undefined;
      if (changed.length > 0) {
        s.fields = merged;
        const versionNo = Math.max(0, ...s.versions.map((v) => v.versionNo)) + 1;
        for (const v of s.versions) v.active = false;
        s.versions.unshift({
          active: true,
          changedFieldKeys: changed,
          createdAt: new Date().toISOString(),
          createdBy: userId,
          createdByName: userById(userId)?.name ?? userId,
          fieldKeys: Object.keys(merged),
          versionNo,
        });
      }
      return ok({ updateSecret: { id: s.id } });
    }),
  ),

  api.mutation(EditorsGenerateKeyPairDocument, ({ request, variables }) =>
    asUser(request, () => {
      const pair = mockKeyPair(variables.format);
      if (!pair) return refusal("INVALID_ARGUMENT", `unsupported key format ${variables.format}`);
      return ok({ generateKeyPair: pair });
    }),
  ),

  api.mutation(EditorsImportCertificateDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const name = variables.name.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "the certificate needs a name");
      const folder = placeIn(userId, variables.folderId);
      if (isResponse(folder)) return folder as never;
      const text = Buffer.from(variables.fileBase64, "base64").toString();
      if (!text.trim()) return refusal("INVALID_ARGUMENT", "unrecognized certificate format");
      // A mock bundle names its entries: "mock-bundle: web, api".
      const bundle = /^mock-bundle:(.*)$/m.exec(text)?.[1];
      const aliases = bundle
        ? bundle
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [];
      if (aliases.length > 0 && !variables.alias)
        return ok({ importCertificate: { aliases, secret: null } });
      if (variables.alias && !aliases.includes(variables.alias))
        return refusal("NOT_FOUND", "no entry with that alias in the file");
      const notAfter = new Date(Date.now() + 365 * DAY).toISOString();
      const s = newSecret(userId, {
        expiresAt: notAfter,
        fields: {
          certificate: text,
          issuer: "CN=Example Issuing CA",
          notAfter,
          subject: `CN=${variables.alias ?? name}`,
        },
        folderId: folder.id,
        name,
        typeId: "type-ssl-cert",
      });
      return ok({ importCertificate: { aliases: [], secret: { id: s.id } } });
    }),
  ),

  api.mutation(EditorsSaveTargetDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const input = variables.input;
      const name = input.name.trim();
      const hostname = input.hostname.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "a target needs a name");
      if (!hostname) return refusal("INVALID_ARGUMENT", "a target needs a hostname");
      if (!world().connections.some((c) => c.id === input.connectionId))
        return refusal("INVALID_ARGUMENT", "pick a connection for the target");
      if (input.id) return refusal("PERMISSION_DENIED", "only a site admin edits targets here");
      const saved: MockTarget = {
        connectionId: input.connectionId,
        hostname,
        id: newToken("mock-target"),
        name,
        ownerUserId: userId,
        sshHostKeys: [],
      };
      world().targets.push(saved);
      return ok({ saveTarget: targetView(saved) });
    }),
  ),
];
