import {
  ApiError,
  BrowseCreateSecretMoveRequestDocument,
  BrowseFoldersDocument,
  BrowseMoveSecretDocument,
  createLogger,
  EditorsCreateSecretDocument,
  EditorsGenerateKeyPairDocument,
  EditorsImportCertificateDocument,
  EditorsPickersDocument,
  type EditorsPickersQuery,
  EditorsSaveTargetDocument,
  EditorsSecretDocument,
  EditorsSecretFieldsDocument,
  type EditorsSecretQuery,
  type EditorsTargetFieldsFragment,
  EditorsUpdateSecretDocument,
  type GatewayClient,
} from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";
import { data, redirect } from "react-router";

import type { Policy } from "@/features/editors/policy";

import {
  findFolder,
  folderLabel,
  type MoveKind,
  moveKind,
  type NavFolder,
  secretDestinations,
} from "@/features/browse/tree";
import {
  type Draft,
  formProblems,
  isCertificateType,
  isSensitive,
  problemCount,
  type Problems,
  type SecretType,
} from "@/features/editors/validate";

const log = createLogger("staff.editors");

/** Codes where the same call may well work a moment later, so the page offers Retry. */
const TRANSIENT = new Set(["DEADLINE_EXCEEDED", "INTERNAL", "UNAVAILABLE", "UNKNOWN"]);

export type Connection = EditorsPickersQuery["connections"][number];
export type EditorActionResult =
  | { aliases: string[]; intent: "import-cert"; ok: true }
  | { intent: "create-target"; ok: true; target: Target }
  | { intent: "generate-key"; keyPair: { privateKey: string; publicKey: string }; ok: true }
  | { intent: string; ok: false; problems?: Problems; refusal?: Refusal };

export interface EditorData {
  connections: Connection[];
  /** The form's starting values. Sensitive values are never in here. */
  draft: { expires: string; targetId: string } & Draft;
  /** The folders a new secret may go in; on edit, its own folder and where it may move. */
  folders: FolderChoice[];
  mode: "edit" | "new";
  /** On edit, how a move to each folder goes, by browse's gate (`moveKind`). */
  moves?: Record<string, MoveKind>;
  ok: true;
  policies: Policy[];
  /** The secret being edited. */
  secretId?: string;
  targets: Target[];
  types: SecretType[];
}

export type EditorLoad = { failure: LoadFailure; ok: false } | EditorData;

export interface FolderChoice {
  id: string;
  path: string;
}

export interface LoadFailure {
  message: string;
  retry: boolean;
}

export type Target = EditorsTargetFieldsFragment;

const paths = (folders: EditorsPickersQuery["folders"]) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return (id: string) => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (
      let f = byId.get(id);
      f && !seen.has(f.id);
      f = f.parentId ? byId.get(f.parentId) : undefined
    ) {
      seen.add(f.id);
      names.unshift(f.name);
    }
    return names.join(" / ");
  };
};

const pickers = async (gw: GatewayClient) => {
  const d = await gw.gql(EditorsPickersDocument, {});
  const pathOf = paths(d.folders);
  return {
    all: d,
    manageable: d.folders
      .filter((f) => f.canManage)
      .map((f) => ({ id: f.id, path: pathOf(f.id) }))
      .toSorted((a, b) => a.path.localeCompare(b.path)),
    pathOf,
  };
};

const failed = (error: unknown, context: Record<string, string>): EditorLoad => {
  const refusal = refusalOf(error);
  if (refusal) {
    log.warn("editor: refused", { ...context, code: refusal.code, reason: refusal.reason });
    return {
      failure: {
        message: refusalMessage(refusal),
        retry: !refusal.code || TRANSIENT.has(refusal.code),
      },
      ok: false,
    };
  }
  if (error instanceof ApiError && error.status >= 500) {
    log.error("editor: gateway error", { ...context, status: error.status });
    return { failure: { message: "The server had a problem. Try again.", retry: true }, ok: false };
  }
  throw error;
};

/** U-05: the new secret form, with `?folder=<id>` picking the folder when the user may add to it. */
export const loadNewSecret = async (request: Request): Promise<EditorLoad> => {
  const { gw, user } = await requireUser(request);
  const wanted = new URL(request.url).searchParams.get("folder") ?? "";
  const started = Date.now();
  log.debug("new secret: loading", { folderId: wanted, userId: user.id });
  return guard(request, async () => {
    try {
      const p = await pickers(gw);
      const folderId = p.manageable.some((f) => f.id === wanted) ? wanted : "";
      log.debug("new secret: loaded", {
        folders: p.manageable.length,
        ms: Date.now() - started,
        types: p.all.secretTypes.length,
        userId: user.id,
      });
      return {
        connections: p.all.connections,
        draft: { expires: "", folderId, name: "", targetId: "", typeId: "", values: {} },
        folders: p.manageable,
        mode: "new" as const,
        ok: true as const,
        policies: p.all.passwordPolicies,
        targets: p.all.targets,
        types: p.all.secretTypes,
      };
    } catch (error) {
      return failed(error, { userId: user.id });
    }
  });
};

/** Where a secret in `fromId` can move, with how each move goes, as browse decides it. */
const moveChoices = (folders: NavFolder[], fromId: string, admin: boolean) => {
  const from = findFolder(folders, fromId);
  if (!from) return null;
  const destinations = secretDestinations(folders, from);
  // Someone who edits a secret needn't manage its folder; it stays on offer so the form can keep it.
  const choices = destinations.some((c) => c.self)
    ? destinations
    : [{ folder: from, label: folderLabel(folders, from), self: true }, ...destinations];
  return {
    folders: choices.map((c) => ({ id: c.folder.id, path: c.label })),
    moves: Object.fromEntries(
      choices.map((c) => [c.folder.id, moveKind(folders, from, c.folder, admin)]),
    ) as Record<string, MoveKind>,
  };
};

const missing = () =>
  data({ code: "NOT_FOUND", detail: "", metadata: {} } satisfies Refusal, { status: 404 });

/** U-05 edit: the secret's form, with its non-sensitive values. */
export const loadEditSecret = async (request: Request, id: string): Promise<EditorLoad> => {
  const { gw, user } = await requireUser(request);
  const started = Date.now();
  log.debug("edit secret: loading", { secretId: id, userId: user.id });
  return guard(request, async () => {
    let found: EditorsSecretQuery | null;
    try {
      found = await gw.gql(EditorsSecretDocument, { id });
    } catch (error) {
      if (refusalOf(error)?.code === "NOT_FOUND") found = null;
      else return failed(error, { secretId: id, userId: user.id });
    }
    const secret = found?.secret;
    if (!found || !secret) {
      log.info("edit secret: not found", { secretId: id, userId: user.id });
      throw missing();
    }
    try {
      const [p, fields, nav] = await Promise.all([
        pickers(gw),
        gw.gql(EditorsSecretFieldsDocument, { id }),
        gw.gql(BrowseFoldersDocument, {}),
      ]);
      const where = moveChoices(nav.folders, secret.folderId, isAdmin(user));
      log.debug("edit secret: loaded", { ms: Date.now() - started, secretId: id, userId: user.id });
      return {
        connections: p.all.connections,
        draft: {
          expires: secret.expiresAt ? secret.expiresAt.slice(0, 10) : "",
          folderId: secret.folderId,
          name: secret.name,
          targetId: secret.targetId ?? "",
          typeId: secret.typeId,
          values: Object.fromEntries(fields.secretFields.map((f) => [f.key, f.value])),
        },
        folders: where?.folders ?? [{ id: secret.folderId, path: p.pathOf(secret.folderId) }],
        mode: "edit" as const,
        moves: where?.moves ?? {},
        ok: true as const,
        policies: p.all.passwordPolicies,
        secretId: id,
        targets: p.all.targets,
        types: p.all.secretTypes,
      };
    } catch (error) {
      return failed(error, { secretId: id, userId: user.id });
    }
  });
};

const text = (f: FormData, key: string) => String(f.get(key) ?? "");

const FIELD = "f:";

/** The draft a save posted: the basics, and each field as `f:<key>`. */
export const draftFrom = (f: FormData): { expires: string; targetId: string } & Draft => {
  const values: Record<string, string> = {};
  for (const [key, value] of f.entries()) {
    if (key.startsWith(FIELD) && typeof value === "string") values[key.slice(FIELD.length)] = value;
  }
  return {
    expires: text(f, "expires").trim(),
    folderId: text(f, "folderId").trim(),
    name: text(f, "name").trim(),
    targetId: text(f, "targetId").trim(),
    typeId: text(f, "typeId").trim(),
    values,
  };
};

const expiry = (date: string) => (date ? new Date(`${date}T00:00:00Z`).toISOString() : "");

/** The move an edit asks for: none, or where to and how browse's gate says it goes. */
const plannedMove = async (gw: GatewayClient, id: string, to: string, admin: boolean) => {
  const [{ secret }, nav] = await Promise.all([
    gw.gql(EditorsSecretDocument, { id }),
    gw.gql(BrowseFoldersDocument, {}),
  ]);
  if (!secret || !to || to === secret.folderId) return null;
  const from = findFolder(nav.folders, secret.folderId);
  const destination = findFolder(nav.folders, to);
  if (!from || !destination) return null;
  return {
    kind: moveKind(nav.folders, from, destination, admin),
    label: folderLabel(nav.folders, destination),
    to,
  };
};

const save = async (
  gw: GatewayClient,
  f: FormData,
  id: string | undefined,
  userId: string,
  admin: boolean,
): Promise<EditorActionResult | Response> => {
  const d = draftFrom(f);
  const { passwordPolicies, secretTypes } = await gw.gql(EditorsPickersDocument, {});
  const type = secretTypes.find((t) => t.id === d.typeId);
  const editing = !!id;
  const problems = formProblems(d, type, passwordPolicies, { editing });
  const move = id ? await plannedMove(gw, id, d.folderId, admin) : null;
  const reason = text(f, "moveReason").trim();
  if (move?.kind === "request" && !reason)
    problems.basics.folderId = {
      message: "Say why it belongs in a personal folder.",
      summary: "A move request needs a reason",
    };
  if (problemCount(problems) > 0 || !type) {
    log.info("secret save: problems", {
      count: problemCount(problems),
      fields: Object.keys(problems.fields).join(","),
      secretId: id ?? "",
      userId,
    });
    return { intent: "save", ok: false, problems };
  }
  const fields = isCertificateType(type)
    ? []
    : type.fields
        // On edit a blank sensitive value isn't sent, so the vault keeps the stored one.
        .filter((field) => !(editing && isSensitive(field) && !(d.values[field.key] ?? "").trim()))
        .map((field) => ({ key: field.key, value: d.values[field.key] ?? "" }));
  if (id) {
    await gw.gql(EditorsUpdateSecretDocument, {
      id,
      input: {
        expiresAt: expiry(d.expires),
        fields: fields.length > 0 ? fields : undefined,
        name: d.name,
        targetId: d.targetId,
      },
    });
    log.info("secret updated", { fields: fields.length, secretId: id, userId });
    if (move?.kind === "request") {
      await gw.gql(BrowseCreateSecretMoveRequestDocument, {
        destFolderId: move.to,
        destFolderName: move.label,
        reason,
        secretId: id,
        secretName: d.name,
      });
      log.info("secret move requested", { folderId: move.to, secretId: id, userId });
    } else if (move) {
      await gw.gql(BrowseMoveSecretDocument, { folderId: move.to, id });
      log.info("secret moved", { folderId: move.to, kind: move.kind, secretId: id, userId });
    }
    return redirect(`/secret/${id}`);
  }
  const r = await gw.gql(EditorsCreateSecretDocument, {
    input: {
      expiresAt: expiry(d.expires) || undefined,
      fields,
      folderId: d.folderId,
      name: d.name,
      targetId: d.targetId || undefined,
      typeId: type.id,
    },
  });
  log.info("secret created", {
    folderId: d.folderId,
    secretId: r.createSecret.id,
    typeId: type.id,
    userId,
  });
  return redirect(`/secret/${r.createSecret.id}`);
};

const run = async (
  gw: GatewayClient,
  intent: string,
  f: FormData,
  id: string | undefined,
  userId: string,
  admin: boolean,
): Promise<EditorActionResult | Response> => {
  switch (intent) {
    case "create-target": {
      const r = await gw.gql(EditorsSaveTargetDocument, {
        input: {
          connectionId: text(f, "connectionId"),
          hostname: text(f, "hostname").trim(),
          name: text(f, "name").trim(),
        },
      });
      log.info("personal target created", { targetId: r.saveTarget.id, userId });
      return { intent, ok: true, target: r.saveTarget };
    }
    case "generate-key": {
      const format = text(f, "format");
      const r = await gw.gql(EditorsGenerateKeyPairDocument, { format });
      log.info("key pair generated", { format, userId });
      return { intent, keyPair: r.generateKeyPair, ok: true };
    }
    case "import-cert": {
      const passphrase = text(f, "passphrase");
      const alias = text(f, "alias");
      const r = await gw.gql(EditorsImportCertificateDocument, {
        alias: alias || undefined,
        fileBase64: text(f, "fileBase64"),
        folderId: text(f, "folderId"),
        name: text(f, "name").trim(),
        passphrase: passphrase || undefined,
      });
      const created = r.importCertificate.secret;
      if (created) {
        log.info("certificate imported", { secretId: created.id, userId });
        return redirect(`/secret/${created.id}`);
      }
      log.info("certificate bundle: entry needed", {
        entries: r.importCertificate.aliases.length,
        userId,
      });
      return { aliases: r.importCertificate.aliases, intent, ok: true };
    }
    case "save": {
      return save(gw, f, id, userId, admin);
    }
  }
  return {
    intent,
    ok: false,
    refusal: { code: "INVALID_ARGUMENT", detail: "unknown action", metadata: {} },
  };
};

/** Every form on the editor: save, generate a key pair, make a target, import a certificate. */
export const editorAction = async (request: Request, id?: string): Promise<EditorActionResult> => {
  const { gw, user } = await requireUser(request);
  const f = await request.formData();
  const intent = text(f, "intent");
  log.info("editor action", { intent, secretId: id ?? "", userId: user.id });
  return guard(request, async () => {
    try {
      const result = await run(gw, intent, f, id, user.id, isAdmin(user));
      if (result instanceof Response) throw result;
      return result;
    } catch (error) {
      if (error instanceof Response) throw error;
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("editor action failed", { intent, secretId: id ?? "", userId: user.id });
        throw error;
      }
      log.warn("editor action: refused", {
        code: refusal.code,
        intent,
        reason: refusal.reason,
        secretId: id ?? "",
        userId: user.id,
      });
      return { intent, ok: false, refusal };
    }
  });
};
