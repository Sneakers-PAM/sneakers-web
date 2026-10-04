import {
  createLogger,
  type GatewayClient,
  SharingFolderAccessDocument,
  SharingFolderRulesetDocument,
  SharingFoldersDocument,
  type SharingFoldersQuery,
  type SharingRuleFieldsFragment,
  SharingSearchUsersDocument,
  SharingSecretAccessDocument,
  SharingSecretDocument,
  SharingSecretRulesetDocument,
  SharingSetFolderRulesetDocument,
  SharingSetSecretRulesetDocument,
  SharingSimulateFolderDocument,
  SharingSimulateSecretDocument,
  SharingUserLabelsDocument,
} from "@sneakers-web/api-client";
import {
  fromRaciRule,
  type Refusal,
  refusalOf,
  type RulesetDraft,
  type RulesetRule,
  type RulesetSubject,
  toRaciRuleInput,
} from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";
import { data } from "react-router";

import type {
  NoAccessData,
  RulesetData,
  SharingData,
  SharingKind,
  SharingResult,
} from "@/features/sharing/types";

const log = createLogger("sharing");

type Folder = SharingFoldersQuery["folders"][number];

const notFound = () =>
  data({ code: "NOT_FOUND", detail: "", metadata: {} } satisfies Refusal, { status: 404 });

/** The folder and every folder above it, nearest first. */
const lineage = (folders: Folder[], id: string): Folder[] => {
  const out: Folder[] = [];
  for (let f = folders.find((x) => x.id === id); f && !out.includes(f);) {
    out.push(f);
    const parentId: null | string | undefined = f.parentId;
    f = parentId ? folders.find((x) => x.id === parentId) : undefined;
  }
  return out;
};

const pathOf = (folders: Folder[], id: string) =>
  lineage(folders, id)
    .toReversed()
    .map((f) => f.name)
    .join(" / ");

const unique = (ids: string[]) => [...new Set(ids)];

const labelsFor = async (gw: GatewayClient, ids: string[]): Promise<Record<string, string>> => {
  if (ids.length === 0) return {};
  const { resolveUserLabels } = await gw.gql(SharingUserLabelsDocument, { ids: unique(ids) });
  return Object.fromEntries(resolveUserLabels.map((l) => [l.id, l.name]));
};

const userIds = (rules: SharingRuleFieldsFragment[]) =>
  rules.filter((r) => r.subjectKind === "user").map((r) => r.subjectName);

const names = (ids: string[], labels: Record<string, string>) =>
  unique(ids).map((id) => labels[id] ?? id);

/** Owners of the folder and those above it, nearest first: who to ask. */
const chainOwners = (folders: Folder[], id: string) =>
  unique(lineage(folders, id).flatMap((f) => f.owners ?? []));

/** A refusal for a folder or secret the user can't know about becomes the page's 404. */
const orNotFound = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work;
  } catch (error) {
    if (refusalOf(error)?.code === "NOT_FOUND") throw notFound();
    throw error;
  }
};

const loadFolder = async (
  gw: GatewayClient,
  admin: boolean,
  folderId: string,
): Promise<SharingData> => {
  const [{ folders }, { myFolderAccess: access }] = await Promise.all([
    gw.gql(SharingFoldersDocument),
    orNotFound(gw.gql(SharingFolderAccessDocument, { folderId })),
  ]);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw notFound();
  const backTo = `/browse/${folderId}`;
  const owners = chainOwners(folders, folderId);
  if (!access.read && !access.manageRuleset) {
    log.info("sharing not readable", { folderId, kind: "folder" });
    const labels = await labelsFor(gw, owners);
    return {
      backTo,
      kind: "folder",
      mode: "none",
      ownerNames: names(owners, labels),
      title: folder.name,
    } satisfies NoAccessData;
  }
  const { folderRuleset: rs, groups } = await gw.gql(SharingFolderRulesetDocument, { folderId });
  const labels = await labelsFor(gw, [
    ...rs.owners,
    ...rs.inheritedOwners.map((o) => o.userId),
    ...userIds(rs.rules),
    ...userIds(rs.inherited.map((index) => index.rule)),
  ]);
  const count = folder.subtreeSecretCount;
  return {
    backTo,
    canEditEveryone: admin,
    eyebrow: "Sharing · Folder",
    id: folderId,
    inherited: rs.inherited.map((index) => ({
      ...fromRaciRule(index.rule, labels),
      fromFolderId: index.fromFolderId,
      fromFolderName: index.fromFolderName,
    })),
    inheritedOwners: rs.inheritedOwners.map((o) => ({ ...o, name: labels[o.userId] ?? o.userId })),
    kind: "folder",
    labels,
    mode: access.manageRuleset ? "edit" : "view",
    ownerNames: names([...rs.owners, ...rs.inheritedOwners.map((o) => o.userId)], labels),
    secretCount: count ?? null,
    subjectOptions: [
      ...groups.map((g) => ({ id: g.id, kind: "group" as const, name: g.name })),
      ...unique([...rs.owners, ...userIds(rs.rules)]).map((id) => ({
        id,
        kind: "user" as const,
        name: labels[id] ?? id,
      })),
    ],
    subtitle:
      count == null
        ? "Rules apply to everything inside, including subfolders"
        : `${count} ${count === 1 ? "secret" : "secrets"} · rules apply to everything inside, including subfolders`,
    title: pathOf(folders, folderId),
    value: {
      owners: rs.owners,
      rules: rs.rules.toSorted((a, b) => a.order - b.order).map((r) => fromRaciRule(r, labels)),
    },
  } satisfies RulesetData;
};

const loadSecret = async (
  gw: GatewayClient,
  admin: boolean,
  secretId: string,
): Promise<SharingData> => {
  const [{ secret }, { folders }] = await Promise.all([
    gw.gql(SharingSecretDocument, { secretId }),
    gw.gql(SharingFoldersDocument),
  ]);
  if (!secret) throw notFound();
  const { mySecretAccess: access } = await orNotFound(
    gw.gql(SharingSecretAccessDocument, { secretId }),
  );
  const backTo = `/secret/${secretId}`;
  const owners = chainOwners(folders, secret.folderId);
  if (!access.read && !access.informed && !access.manageRuleset) {
    log.info("sharing not readable", { kind: "secret", secretId });
    const labels = await labelsFor(gw, owners);
    return {
      backTo,
      kind: "secret",
      mode: "none",
      ownerNames: names(owners, labels),
      title: secret.name,
    } satisfies NoAccessData;
  }
  const { groups, secretRuleset: rs } = await gw.gql(SharingSecretRulesetDocument, { secretId });
  const labels = await labelsFor(gw, [
    ...owners,
    ...userIds(rs.rules),
    ...userIds(rs.inherited.map((index) => index.rule)),
  ]);
  return {
    backTo,
    canEditEveryone: admin,
    eyebrow: "Sharing · Secret",
    id: secretId,
    inherited: rs.inherited.map((index) => ({
      ...fromRaciRule(index.rule, labels),
      fromFolderId: index.fromFolderId,
      fromFolderName: index.fromFolderName,
    })),
    inheritedOwners: [],
    kind: "secret",
    labels,
    mode: access.manageRuleset ? "edit" : "view",
    ownerNames: names(owners, labels),
    secretCount: null,
    subjectOptions: [
      ...groups.map((g) => ({ id: g.id, kind: "group" as const, name: g.name })),
      ...unique([...owners, ...userIds(rs.rules)]).map((id) => ({
        id,
        kind: "user" as const,
        name: labels[id] ?? id,
      })),
    ],
    subtitle: `In ${pathOf(folders, secret.folderId)}`,
    title: secret.name,
    value: {
      rules: rs.rules.toSorted((a, b) => a.order - b.order).map((r) => fromRaciRule(r, labels)),
    },
  } satisfies RulesetData;
};

/** U-07 Sharing: a folder's or secret's ruleset, as an owner may edit it or a reader may see it. */
export const loadSharing = async (
  request: Request,
  kind: SharingKind,
  id: string | undefined,
): Promise<SharingData> => {
  const { gw, user } = await requireUser(request);
  if (!id) throw notFound();
  const started = Date.now();
  log.debug("sharing load", { id, kind });
  return guard(request, async () => {
    const d =
      kind === "folder"
        ? await loadFolder(gw, isAdmin(user), id)
        : await loadSecret(gw, isAdmin(user), id);
    log.debug("sharing loaded", { id, kind, mode: d.mode, ms: Date.now() - started });
    return d;
  });
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const invalid = (detail: string): Refusal => ({ code: "INVALID_ARGUMENT", detail, metadata: {} });

const ACTIONS = new Set(["A", "C", "I", "R"]);
const KINDS = new Set(["everyone", "group", "user"]);

const isSubject = (s: unknown): s is RulesetSubject => {
  if (typeof s !== "object" || s === null) return false;
  const { id, kind, name } = s as Record<string, unknown>;
  return (
    typeof kind === "string" &&
    KINDS.has(kind) &&
    typeof name === "string" &&
    (id === undefined || typeof id === "string")
  );
};

const isRule = (r: unknown): r is RulesetRule => {
  if (typeof r !== "object" || r === null) return false;
  const { grants, subject } = r as Record<string, unknown>;
  return (
    isSubject(subject) &&
    typeof grants === "object" &&
    grants !== null &&
    Object.entries(grants).every(([k, v]) => ACTIONS.has(k) && (v === "allow" || v === "deny"))
  );
};

/** The draft the page posted, checked, since it comes from the browser. */
const draftOf = (form: FormData): null | RulesetDraft => {
  try {
    const parsed: unknown = JSON.parse(text(form, "draft"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { owners, rules } = parsed as Record<string, unknown>;
    if (!Array.isArray(rules) || !rules.every((r) => isRule(r))) return null;
    if (owners !== undefined) {
      if (!Array.isArray(owners) || !owners.every((o) => typeof o === "string")) return null;
      return { owners, rules };
    }
    return { rules };
  } catch {
    return null;
  }
};

const run = async (
  gw: GatewayClient,
  kind: SharingKind,
  id: string,
  intent: string,
  form: FormData,
): Promise<SharingResult> => {
  if (intent === "search") {
    const { searchUsers } = await gw.gql(SharingSearchUsersDocument, {
      limit: 8,
      query: text(form, "query"),
    });
    return {
      intent,
      ok: true,
      people: searchUsers.map((u) => ({ id: u.id, kind: "user", name: u.name })),
    };
  }
  const draft = draftOf(form);
  if (!draft) return { intent, ok: false, refusal: invalid("the sharing draft isn't valid") };
  const rules = draft.rules.map((r) => toRaciRuleInput(r));
  if (intent === "simulate") {
    const userId = text(form, "userId");
    if (kind === "folder") {
      const { simulateFolder } = await gw.gql(SharingSimulateFolderDocument, {
        draftRules: rules,
        folderId: id,
        userId,
      });
      return { decision: simulateFolder, intent, ok: true };
    }
    const { simulateSecret } = await gw.gql(SharingSimulateSecretDocument, {
      draftRules: rules,
      secretId: id,
      userId,
    });
    return { decision: simulateSecret, intent, ok: true };
  }
  if (intent === "save") {
    await (kind === "folder"
      ? gw.gql(SharingSetFolderRulesetDocument, { folderId: id, owners: draft.owners ?? [], rules })
      : gw.gql(SharingSetSecretRulesetDocument, { rules, secretId: id }));
    log.info("sharing saved", { id, kind, rules: rules.length });
    return { done: "Sharing saved", intent, ok: true };
  }
  return { intent, ok: false, refusal: invalid(`unknown intent ${intent}`) };
};

/** One sharing intent: save the draft, simulate a person against it, or search people. */
export const sharingAction = async (
  request: Request,
  kind: SharingKind,
  id: string | undefined,
): Promise<SharingResult> => {
  const { gw } = await requireUser(request);
  if (!id) throw notFound();
  const form = await request.formData();
  const intent = text(form, "intent");
  log.debug("sharing action", { id, intent, kind });
  return guard(request, async () => {
    try {
      return await run(gw, kind, id, intent, form);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("sharing action failed", { error: String(error), id, intent, kind });
        throw error;
      }
      log.info("sharing action refused", {
        code: refusal.code,
        id,
        intent,
        reason: refusal.reason,
      });
      return { intent, ok: false, refusal };
    }
  });
};
