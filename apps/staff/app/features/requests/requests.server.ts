import {
  createLogger,
  RequestsCommentDocument,
  RequestsCreateDocument,
  RequestsListDocument,
  RequestsPeopleDocument,
  type RequestsRequestFieldsFragment,
  RequestsResolveDocument,
} from "@sneakers-web/api-client";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";

import { act, type ActResult, field } from "@/features/requests/act.server";
import {
  DEFAULT_GRANT_HOURS,
  MAX_GRANT_HOURS,
  type NewRequest,
  type RequestRow,
  type RequestsData,
} from "@/features/requests/model";
import { secretsById } from "@/features/requests/secrets.server";

const log = createLogger("requests");

const isMove = (r: RequestsRequestFieldsFragment) => r.kind !== "secret_access";

const newest = (a: RequestRow, b: RequestRow) =>
  Date.parse(b.resolvedAt ?? b.requestedAt) - Date.parse(a.resolvedAt ?? a.requestedAt);

/**
 * U-09: every request the signed-in user takes part in, split the way the page shows them:
 * waiting on them, their own open ones, and the resolved history. `?new=<secretId>` also
 * loads the "request access" form for that secret.
 */
export const loadRequests = async (request: Request): Promise<RequestsData> => {
  const { gw, user } = await requireUser(request);
  const admin = isAdmin(user);
  const newFor = new URL(request.url).searchParams.get("new")?.trim() || null;
  log.debug("requests load", { asking: !!newFor });
  return guard(request, async () => {
    const started = performance.now();
    const { approvalRequests } = await gw.gql(RequestsListDocument);
    const secretIds = approvalRequests
      .filter((r) => r.kind !== "folder_move")
      .map((r) => r.secretId);
    const secrets = await secretsById(gw, newFor ? [...secretIds, newFor] : secretIds);

    const mayDecide = (r: RequestsRequestFieldsFragment) =>
      r.requestedByUserId !== user.id &&
      (isMove(r) ? admin : (secrets.get(r.secretId)?.approve ?? false));
    const involved = approvalRequests.filter(
      (r) => r.requestedByUserId === user.id || r.resolvedByUserId === user.id || mayDecide(r),
    );

    const { resolveUserLabels } = await gw.gql(RequestsPeopleDocument, {
      ids: [...new Set(involved.map((r) => r.requestedByUserId))],
    });
    const people = new Map(resolveUserLabels.map((p) => [p.id, p.name]));

    const row = (r: RequestsRequestFieldsFragment): RequestRow => {
      const move = isMove(r);
      const secretName = secrets.get(r.secretId)?.name;
      return {
        canDecide: r.status === "pending" && mayDecide(r),
        comments: r.comments.map((c) => ({
          author: c.authorName || people.get(c.authorUserId) || "Someone",
          body: c.body,
          createdAt: c.createdAt,
          id: c.id,
          mine: c.authorUserId === user.id,
        })),
        dest: r.destParentName || "a personal folder",
        id: r.id,
        isMove: move,
        kind: r.kind,
        mine: r.requestedByUserId === user.id,
        reason: r.reason?.trim() || "",
        requestedAt: r.requestedAt,
        requestedBy: people.get(r.requestedByUserId) ?? "Someone",
        resolvedAt: r.resolvedAt ?? null,
        resolvedBy: r.resolvedByUserName || (r.resolvedByUserId ? "Someone" : null),
        resource: move
          ? `${r.folderName || "Item"} → ${r.destParentName || "a personal folder"}`
          : (secretName ?? "A secret you can't see"),
        secretId: move ? null : r.secretId,
        src: r.kind === "folder_move" ? r.folderName : "its shared folder",
        status: r.status,
      };
    };

    const rows = involved.map((r) => row(r));
    const awaiting = rows.filter((r) => r.canDecide).toSorted(newest);
    const open = rows.filter((r) => r.mine && r.status === "pending").toSorted(newest);
    const history = rows.filter((r) => r.status !== "pending").toSorted(newest);

    let asking: NewRequest | null = null;
    if (newFor) {
      const s = secrets.get(newFor);
      asking = {
        alreadyPending: open.some((r) => r.secretId === newFor),
        name: s?.name ?? null,
        secretId: newFor,
      };
    }

    log.debug("requests loaded", {
      awaiting: awaiting.length,
      history: history.length,
      ms: Math.round(performance.now() - started),
      open: open.length,
    });
    return {
      approver: admin || awaiting.length > 0,
      asking,
      awaiting,
      defaultHours: DEFAULT_GRANT_HOURS,
      history,
      maxHours: MAX_GRANT_HOURS,
      open,
    };
  });
};

const hoursFrom = (raw: string): number => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_GRANT_HOURS;
  return Math.min(n, MAX_GRANT_HOURS);
};

/** The page's form intents: resolve (approve or deny), comment, and create a request. */
export const requestsAction = async (request: Request): Promise<ActResult> => {
  const form = await request.formData();
  const intent = field(form, "intent");
  if (intent === "resolve") {
    const approve = field(form, "decision") === "approve";
    const id = field(form, "id");
    const access = field(form, "kind") === "secret_access";
    return act(request, intent, async (gw) => {
      const { resolveApproval: r } = await gw.gql(RequestsResolveDocument, {
        approve,
        grantHours: approve && access ? hoursFrom(field(form, "hours")) : undefined,
        id,
      });
      log.info("request resolved", { approve, kind: r.kind, requestId: id });
      return approve ? (isMove(r) ? "moved" : "approved") : "denied";
    });
  }
  if (intent === "comment") {
    const id = field(form, "id");
    return act(request, intent, async (gw) => {
      await gw.gql(RequestsCommentDocument, { body: field(form, "body"), requestId: id });
      log.info("comment added", { requestId: id });
      return id;
    });
  }
  if (intent === "create") {
    const secretId = field(form, "secretId");
    return act(request, intent, async (gw) => {
      const { createAccessRequest: r } = await gw.gql(RequestsCreateDocument, {
        reason: field(form, "reason") || undefined,
        secretId,
      });
      log.info("access requested", { requestId: r.id, secretId });
      return r.id;
    });
  }
  log.warn("unknown intent", { intent });
  throw new Response("Unknown intent", { status: 400 });
};
