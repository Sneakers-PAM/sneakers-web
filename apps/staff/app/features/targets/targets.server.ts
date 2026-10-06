import {
  createLogger,
  TargetsDeleteDocument,
  TargetsListDocument,
  type TargetsListQuery,
  TargetsSaveDocument,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser, type SessionUser } from "@sneakers-web/shell/server";
import { data, redirect } from "react-router";

import type {
  ConnectionChoice,
  ConnectionEntry,
  TargetDraft,
  TargetRow,
  TargetsResult,
} from "@/features/targets/model";

import { EMPTY_DRAFT } from "@/features/targets/model";

const log = createLogger("targets");

type Target = TargetsListQuery["targets"][number];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** The vault's rule: the owner of a personal target, or a site admin for any target. */
const canManage = (user: SessionUser, t: Target) =>
  isAdmin(user) || (!!t.ownerUserId && t.ownerUserId === user.id);

/** U-10: the targets the user can see, shared and their own, and which they may change. */
export const loadTargets = async (
  request: Request,
): Promise<{ canCreate: boolean; rows: TargetRow[] }> => {
  const { gw, user } = await requireUser(request);
  log.debug("targets load");
  return guard(request, async () => {
    const d = await gw.gql(TargetsListDocument);
    const names = new Map(d.connections.map((c) => [c.id, c.name]));
    const rows = d.targets.map((t) => ({
      canManage: canManage(user, t),
      connection: names.get(t.connectionId) ?? null,
      hostname: t.hostname,
      id: t.id,
      name: t.name,
      scope: t.ownerUserId ? ("personal" as const) : ("shared" as const),
      secretCount: t.secretCount,
    }));
    log.debug("targets loaded", { count: rows.length });
    return { canCreate: d.connections.length > 0, rows };
  });
};

/** The /targets form: `delete` by `id` (with its `name` for the note). */
export const targetsAction = async (request: Request): Promise<TargetsResult> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = text(form, "intent");
  if (intent !== "delete") {
    log.warn("unknown intent", { intent });
    throw new Response("Unknown intent", { status: 400 });
  }
  const id = text(form, "id");
  log.debug("target delete", { targetId: id });
  return guard(request, async () => {
    try {
      const { deleteTarget } = await gw.gql(TargetsDeleteDocument, { id });
      if (!deleteTarget) {
        log.info("target delete refused: in use", { targetId: id });
        return { intent, inUse: true, ok: false, refusal: null };
      }
      log.info("target deleted", { targetId: id });
      return { done: `Deleted ${text(form, "name") || "the target"}.`, intent, ok: true };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("target delete failed", { error: String(error), targetId: id });
        throw error;
      }
      log.info("target delete refused", { code: refusal.code, targetId: id });
      return { intent, inUse: false, ok: false, refusal };
    }
  });
};

export interface TargetEditorData {
  connections: ConnectionChoice[];
  draft: TargetDraft;
  /** Shared targets a plain user can't change here, named in the editor's note. */
  sharedNames: string[];
  target: { id: string; scope: "personal" | "shared"; secretCount: number } | null;
}

const connectionLabel = (c: TargetsListQuery["connections"][number]) =>
  [c.name, c.protocol, c.port ? String(c.port) : ""].filter(Boolean).join(" · ");

/** Form fields for the connections list: a `connectionId` per row, in order, and the
 * `defaultConnectionId` of whichever row is the default. Falls back to the first row when none
 * is named (a lone connection has no radio to check). */
const connectionsOf = (form: FormData): ConnectionEntry[] => {
  const ids = form.getAll("connectionId").map(String).filter(Boolean);
  const named = text(form, "defaultConnectionId");
  const defaultId = ids.includes(named) ? named : ids[0];
  return ids.map((connectionId) => ({ connectionId, isDefault: connectionId === defaultId }));
};

/**
 * U-11: a new target (personal for a plain user), or one the user may change. A target they
 * can't see is a 404 and one they can't change a 403, for the page's error screen.
 */
export const loadTargetEditor = async (
  request: Request,
  id?: string,
): Promise<TargetEditorData> => {
  const { gw, user } = await requireUser(request);
  log.debug("target editor load", { targetId: id ?? "new" });
  return guard(request, async () => {
    const d = await gw.gql(TargetsListDocument);
    const connections = d.connections.map((c) => ({
      label: connectionLabel(c),
      protocol: c.protocol,
      value: c.id,
    }));
    const sharedNames = isAdmin(user)
      ? []
      : d.targets.filter((t) => !t.ownerUserId).map((t) => t.name);
    if (!id)
      return {
        connections,
        draft: {
          ...EMPTY_DRAFT,
          connections: connections[0]
            ? [{ connectionId: connections[0].value, isDefault: true }]
            : [],
        },
        sharedNames,
        target: null,
      };
    const t = d.targets.find((x) => x.id === id);
    if (!t) {
      log.info("target editor: not found", { targetId: id });
      throw Response.json({ kind: "not-found" }, { status: 404 });
    }
    if (!canManage(user, t)) {
      log.info("target editor: not the owner", { targetId: id });
      throw Response.json({ kind: "forbidden" }, { status: 403 });
    }
    return {
      connections,
      draft: {
        connections: t.connections.map((c) => ({
          connectionId: c.connectionId,
          isDefault: c.isDefault,
        })),
        description: t.description ?? "",
        domain: t.domain ?? "",
        hostname: t.hostname,
        kind: t.kind ?? "",
        name: t.name,
        realm: t.realm ?? "",
      },
      sharedNames,
      target: {
        id: t.id,
        scope: t.ownerUserId ? "personal" : "shared",
        secretCount: t.secretCount,
      },
    };
  });
};

/**
 * Save the editor's form. Host-key pins are left out, so the gateway keeps the target's own;
 * only admins change them, in the admin console. Done goes back to the list; a refusal comes
 * back with what was typed.
 */
export const saveTargetAction = async (request: Request, id?: string) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const draft: TargetDraft = {
    connections: connectionsOf(form),
    description: text(form, "description"),
    domain: text(form, "domain"),
    hostname: text(form, "hostname"),
    kind: text(form, "kind"),
    name: text(form, "name"),
    realm: text(form, "realm"),
  };
  log.debug("target save", { targetId: id ?? "new" });
  return guard(request, async () => {
    try {
      const { saveTarget } = await gw.gql(TargetsSaveDocument, {
        input: {
          connections: draft.connections,
          description: draft.description || null,
          domain: draft.domain || null,
          hostname: draft.hostname,
          id: id ?? null,
          kind: draft.kind || null,
          name: draft.name,
          realm: draft.realm || null,
        },
      });
      log.info("target saved", { created: !id, targetId: saveTarget.id });
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("target save failed", { error: String(error), targetId: id ?? "new" });
        throw error;
      }
      log.info("target save refused", { code: refusal.code, targetId: id ?? "new" });
      return data<{ draft: TargetDraft; refusal: Refusal }>({ draft, refusal }, { status: 400 });
    }
    throw redirect("/targets");
  });
};
