import {
  BrowseCreateFolderDocument,
  BrowseCreateFolderMoveRequestDocument,
  BrowseCreateSecretMoveRequestDocument,
  BrowseDeleteFolderDocument,
  BrowseFolderAccessDocument,
  BrowseFoldersDocument,
  BrowseMoveFolderDocument,
  BrowseMoveSecretDocument,
  BrowseRenameFolderDocument,
  BrowseReorderFoldersDocument,
  BrowseRestoreSecretDocument,
  BrowseSecretsDocument,
  createLogger,
  type GatewayClient,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";
import { data, redirect } from "react-router";

import type { BrowseData, BrowseResult, BrowseSecret } from "@/features/browse/types";

import { findFolder, lineage } from "@/features/browse/tree";

const log = createLogger("browse");

/** The folder list, plus the open folder: its access, its owners and, if readable, its secrets. */
export const loadBrowse = async (
  request: Request,
  folderId: string | undefined,
): Promise<BrowseData> => {
  const { gw, user } = await requireUser(request);
  const includeRetired = new URL(request.url).searchParams.get("retired") === "1";
  const started = Date.now();
  log.debug("browse load", { folderId, includeRetired });
  return guard(request, async () => {
    const { folders } = await gw.gql(BrowseFoldersDocument);
    const base = { folders, includeRetired, isAdmin: isAdmin(user), userId: user.id };
    if (!folderId) {
      log.debug("browse loaded", { folders: folders.length, ms: Date.now() - started });
      return { ...base, current: null };
    }
    const folder = findFolder(folders, folderId);
    if (!folder) {
      log.info("browse folder not found", { folderId });
      throw data({ code: "NOT_FOUND", detail: "", metadata: {} } satisfies Refusal, {
        status: 404,
      });
    }
    const { myFolderAccess, resolveUserLabels } = await gw.gql(BrowseFolderAccessDocument, {
      folderId,
      ownerIds: folder.owners ?? [],
    });
    let secrets: BrowseSecret[] | null = null;
    let types: Record<string, string> = {};
    if (myFolderAccess.read) {
      const d = await gw.gql(BrowseSecretsDocument, { folderId, includeRetired });
      secrets = d.secretsInFolder.toSorted((a, b) => a.name.localeCompare(b.name));
      types = Object.fromEntries(d.secretTypes.map((t) => [t.id, t.name]));
    } else {
      log.info("browse folder not readable", { folderId });
    }
    log.debug("browse loaded", {
      folderId,
      ms: Date.now() - started,
      secrets: secrets?.length ?? null,
    });
    return {
      ...base,
      current: {
        access: myFolderAccess,
        folder,
        owners: resolveUserLabels,
        path: lineage(folders, folder)
          .slice(0, -1)
          .map((f) => f.name),
        secrets,
        types,
      },
    };
  });
};

const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string): null | string => text(form, key) || null;

/** The secrets a bulk action names, as {id, name} pairs. Anything malformed is dropped. */
const secretsOf = (form: FormData): { id: string; name: string }[] => {
  try {
    const parsed: unknown = JSON.parse(text(form, "secrets") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is { id: string; name: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { id?: unknown }).id === "string" &&
        typeof (s as { name?: unknown }).name === "string",
    );
  } catch {
    return [];
  }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const run = async (
  gw: GatewayClient,
  intent: string,
  form: FormData,
  folderId: string | undefined,
): Promise<Response | string> => {
  switch (intent) {
    case "create": {
      const name = text(form, "name");
      await gw.gql(BrowseCreateFolderDocument, { name, parentId: optional(form, "parentId") });
      return `Folder ${name} created`;
    }
    case "delete": {
      const id = text(form, "id");
      const reassignToId = optional(form, "reassignTo");
      const parentId = optional(form, "parentId");
      await gw.gql(BrowseDeleteFolderDocument, { id, reassignToId });
      if (id === folderId) {
        const next = reassignToId ?? parentId;
        return redirect(next ? `/browse/${next}` : "/browse");
      }
      return "Folder deleted";
    }
    case "move-folder": {
      await gw.gql(BrowseMoveFolderDocument, {
        id: text(form, "id"),
        newParentId: optional(form, "dest"),
      });
      return "Folder moved";
    }
    case "move-secrets": {
      const destination = text(form, "dest");
      const list = secretsOf(form);
      for (const s of list)
        await gw.gql(BrowseMoveSecretDocument, { folderId: destination, id: s.id });
      return `${plural(list.length, "secret", "secrets")} moved`;
    }
    case "rename": {
      const name = text(form, "name");
      await gw.gql(BrowseRenameFolderDocument, { id: text(form, "id"), name });
      return `Renamed to ${name}`;
    }
    case "reorder": {
      await gw.gql(BrowseReorderFoldersDocument, {
        orderedIds: text(form, "orderedIds").split(",").filter(Boolean),
        parentId: optional(form, "parentId"),
      });
      return "Folder order saved";
    }
    case "request-folder-move": {
      await gw.gql(BrowseCreateFolderMoveRequestDocument, {
        destParentId: text(form, "dest"),
        destParentName: optional(form, "destName"),
        folderId: text(form, "id"),
        folderName: optional(form, "name"),
        reason: optional(form, "reason"),
      });
      return "Move request sent to a site admin";
    }
    case "request-secret-move": {
      const list = secretsOf(form);
      for (const s of list) {
        await gw.gql(BrowseCreateSecretMoveRequestDocument, {
          destFolderId: text(form, "dest"),
          destFolderName: optional(form, "destName"),
          reason: optional(form, "reason"),
          secretId: s.id,
          secretName: s.name,
        });
      }
      return list.length === 1
        ? "Move request sent to a site admin"
        : `${list.length} move requests sent to a site admin`;
    }
    case "restore": {
      await gw.gql(BrowseRestoreSecretDocument, { id: text(form, "id") });
      return "Secret restored";
    }
    default: {
      throw data("Unknown action", { status: 400 });
    }
  }
};

/** One folder or secret change. A refusal comes back as data for the page to explain. */
export const browseAction = async (
  request: Request,
  folderId: string | undefined,
): Promise<BrowseResult | Response> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = text(form, "intent");
  const started = Date.now();
  log.debug("browse action", { folderId, intent });
  return guard(request, async () => {
    try {
      const done = await run(gw, intent, form, folderId);
      log.info("browse action done", { folderId, intent, ms: Date.now() - started });
      if (done instanceof Response) return done;
      return { done, intent, ok: true as const };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("browse action failed", { folderId, intent, ms: Date.now() - started });
        throw error;
      }
      log.warn("browse action refused", {
        code: refusal.code,
        folderId,
        intent,
        reason: refusal.reason,
      });
      return { intent, ok: false as const, refusal };
    }
  });
};
