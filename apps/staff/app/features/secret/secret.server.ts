import {
  ApiError,
  createLogger,
  type GatewayClient,
  GraphQLRequestError,
  MeDocument,
  SecretAccessDocument,
  type SecretAccessQuery,
  SecretBreakGlassDocument,
  SecretDeleteDocument,
  SecretDetailDocument,
  type SecretDetailFieldsFragment,
  type SecretDetailQuery,
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
  type SecretVersionsQuery,
} from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser, type SessionUser } from "@sneakers-web/shell/server";
import { clockTime } from "@sneakers-web/ui";
import { data, redirect } from "react-router";

import { activeLeaseFor, checkIn, checkOut } from "@/features/requests/leases.server";

const log = createLogger("staff.secret");

/** The identity role for prior values and restores. Only a site admin can grant it. */
const RECOVERY_ROLE = "recovery";

/** Codes where the same call may well work a moment later, so the page offers Retry. */
const TRANSIENT = new Set(["DEADLINE_EXCEEDED", "INTERNAL", "UNAVAILABLE", "UNKNOWN"]);

export interface LoadFailure {
  message: string;
  retry: boolean;
}
export type SecretAccess = SecretAccessQuery["mySecretAccess"];
export type SecretLoad = { failure: LoadFailure; ok: false } | SecretPage;
export interface SecretPage {
  access: SecretAccess;
  /** Non-sensitive field values only. Sensitive ones come back from a reveal action. */
  fields: Record<string, string>;
  folderPath: { id: string; name: string }[];
  /** The change list, for anyone who can read the secret. Null for everyone else. */
  history: null | SecretVersion[];
  isAdmin: boolean;
  /** The secret's active lease, whoever holds it, for types that check out. */
  lease: { expiresAt: string; id: string; userId: string } | null;
  /** When the server answered, so "expires in" and "next rotation" read the same on both sides. */
  now: number;
  ok: true;
  /** Whether the person holds the recovery role, so the history offers a restore. */
  recovery: boolean;
  secret: SecretView;
  target: { connectionId: string; hostname: string; id: string; name: string } | null;
  type: null | SecretType;
  /** The signed-in user's id, to tell their own lease from someone else's. */
  viewerId: string;
}

export type SecretType = SecretDetailQuery["secretTypes"][number];

export type SecretVersion = SecretVersionsQuery["secretVersions"][number];

export type SecretView = SecretDetailFieldsFragment;

const pathTo = (folders: SecretDetailQuery["folders"], folderId: string) => {
  const out: { id: string; name: string }[] = [];
  let f = folders.find((x) => x.id === folderId);
  while (f && !out.some((x) => x.id === f?.id)) {
    out.unshift({ id: f.id, name: f.name });
    const parentId = f.parentId;
    f = parentId ? folders.find((x) => x.id === parentId) : undefined;
  }
  return out;
};

const missing = () =>
  data({ code: "NOT_FOUND", detail: "", metadata: {} } satisfies Refusal, { status: 404 });

const page = async (
  gw: GatewayClient,
  user: SessionUser,
  id: string,
): Promise<null | SecretPage> => {
  const detail = await gw.gql(SecretDetailDocument, { id });
  const secret = detail.secret;
  if (!secret) return null;
  const { mySecretAccess: access } = await gw.gql(SecretAccessDocument, { secretId: id });
  const admin = isAdmin(user);
  const type = detail.secretTypes.find((t) => t.id === secret.typeId) ?? null;
  const [fields, history, lease] = await Promise.all([
    access.read ? gw.gql(SecretFieldsDocument, { id }) : null,
    access.read ? gw.gql(SecretVersionsDocument, { secretId: id }) : null,
    type?.checkout ? activeLeaseFor(gw, id) : null,
  ]);
  return {
    access,
    fields: Object.fromEntries((fields?.secretFields ?? []).map((f) => [f.key, f.value])),
    folderPath: pathTo(detail.folders, secret.folderId),
    history: history?.secretVersions ?? null,
    isAdmin: admin,
    lease: lease ? { expiresAt: lease.expiresAt, id: lease.id, userId: lease.userId } : null,
    now: Date.now(),
    ok: true,
    recovery: user.roles.includes(RECOVERY_ROLE),
    secret,
    target: detail.targets.find((t) => t.id === secret.targetId) ?? null,
    type,
    viewerId: user.id,
  };
};

const failed = (error: unknown, secretId: string, userId: string): SecretLoad => {
  const refusal = refusalOf(error);
  if (refusal) {
    log.warn("secret detail: refused", {
      code: refusal.code,
      reason: refusal.reason,
      secretId,
      userId,
    });
    return {
      failure: {
        message: refusalMessage(refusal),
        retry: !refusal.code || TRANSIENT.has(refusal.code),
      },
      ok: false,
    };
  }
  if (error instanceof ApiError && error.status >= 500) {
    log.error("secret detail: gateway error", { secretId, status: error.status });
    return { failure: { message: "The server had a problem. Try again.", retry: true }, ok: false };
  }
  throw error;
};

/**
 * The secret detail page's data, as the signed-in user may see it. A secret they can't see is a
 * 404 for the page's boundary; a refusal or a failing gateway comes back as a failure to show.
 */
export const loadSecret = async (request: Request, id: string): Promise<SecretLoad> => {
  const { gw, user } = await requireUser(request);
  const started = Date.now();
  log.debug("secret detail: loading", { secretId: id, userId: user.id });
  return guard(request, async () => {
    let result: null | SecretPage;
    try {
      result = await page(gw, user, id);
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal?.code === "NOT_FOUND") result = null;
      else return failed(error, id, user.id);
    }
    if (!result) {
      log.info("secret detail: not found", { secretId: id, userId: user.id });
      throw missing();
    }
    log.debug("secret detail: loaded", {
      ms: Date.now() - started,
      read: result.access.read,
      secretId: id,
      userId: user.id,
    });
    return result;
  });
};

export interface ExportedFile {
  contentType: string;
  fileBase64: string;
  filename: string;
}

/** A web reveal waiting for an owner's or approver's decision, or for the user's confirmation. */
export interface PendingReveal {
  /** Nobody else can decide it: the user confirms the task once on its run page. */
  confirm: boolean;
  /** ms */
  expiresAt: number;
  id: string;
  runId: null | string;
}

/** What every form on the page gets back. A revealed value only ever travels in here. */
export type SecretActionResult =
  | {
      /** When break glass was recorded. */
      at?: number;
      done?: string;
      fieldKey?: string;
      fields?: { key: string; value: string }[];
      file?: ExportedFile;
      intent: string;
      ok: true;
      /** A reveal the secret's approval level holds: waiting for a decision or a confirmation. */
      pendingUse?: PendingReveal;
      purpose?: string;
      /** The held reveal a collect was for. */
      useId?: string;
      value?: string;
      versionNo?: number;
    }
  | {
      fieldKey?: string;
      intent: string;
      ok: false;
      purpose?: string;
      refusal: Refusal;
      useId?: string;
      versionNo?: number;
    };

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

const invalid = (message: string) =>
  new GraphQLRequestError([{ extensions: { code: "INVALID_ARGUMENT" }, message }]);

type Done = Omit<Extract<SecretActionResult, { ok: true }>, "intent" | "ok">;

const run = async (
  gw: GatewayClient,
  id: string,
  intent: string,
  f: FormData,
): Promise<Done | Response> => {
  switch (intent) {
    case "automation": {
      const r = await gw.gql(SecretSetAutomationDocument, {
        disableHeartbeat: text(f, "disableHeartbeat") === "true",
        disableRotation: text(f, "disableRotation") === "true",
        secretId: id,
      });
      const s = r.setSecretAutomation;
      return {
        done: `Automation saved. Rotation ${s.rotationOptOut ? "off" : "on"}, heartbeat ${s.heartbeatOptOut ? "off" : "on"}.`,
      };
    }
    case "break-glass": {
      const reason = text(f, "reason");
      if (!reason) throw invalid("desc = add a reason so the owners know why");
      const r = await gw.gql(SecretBreakGlassDocument, {
        code: text(f, "code"),
        reason,
        secretId: id,
      });
      return {
        done: "Break glass recorded. The owners were notified.",
        fields: r.breakGlassSecret,
      };
    }
    case "delete": {
      const { secret } = await gw.gql(SecretDetailDocument, { id });
      await gw.gql(SecretDeleteDocument, { id });
      return redirect(secret ? `/browse/${secret.folderId}` : "/browse");
    }
    case "export": {
      const passphrase = text(f, "passphrase");
      const r = await gw.gql(SecretExportCertificateDocument, {
        format: text(f, "format"),
        newPassphrase: passphrase || undefined,
        secretId: id,
      });
      return { done: `Exported ${r.exportCertificate.filename}.`, file: r.exportCertificate };
    }
    case "replace": {
      const fileBase64 = text(f, "fileBase64");
      if (!fileBase64) throw invalid("desc = choose a certificate file");
      const passphrase = text(f, "passphrase");
      const r = await gw.gql(SecretReplaceCertificateDocument, {
        fileBase64,
        passphrase: passphrase || undefined,
        secretId: id,
      });
      if (!r.replaceCertificate.secret)
        throw invalid("desc = that file holds more than one certificate; pick one and try again");
      return { done: "Certificate replaced. A new version was added." };
    }
    case "restore": {
      const r = await gw.gql(SecretRestoreDocument, { id });
      return { done: `${r.restoreSecret.name} restored.` };
    }
    case "restore-version": {
      const versionNo = Number(text(f, "versionNo"));
      if (!Number.isInteger(versionNo) || versionNo < 1)
        throw invalid("desc = pick the version to restore");
      await gw.gql(SecretRestoreVersionDocument, { secretId: id, versionNo });
      const { secretVersions } = await gw.gql(SecretVersionsDocument, { secretId: id });
      const now = secretVersions.find((v) => v.active)?.versionNo;
      return {
        done: `Version ${versionNo}'s values are the current ones now${now ? `, as version ${now}` : ""}.`,
        versionNo,
      };
    }
    case "retire": {
      const r = await gw.gql(SecretRetireDocument, { id });
      return { done: `${r.retireSecret.name} retired.` };
    }
    case "reveal": {
      const fieldKey = text(f, "fieldKey");
      try {
        const r = await gw.gql(SecretRevealDocument, { fieldKey, id });
        return { fieldKey, value: r.revealSecretField };
      } catch (error) {
        if (refusalOf(error)?.reason !== "APPROVAL_REQUIRED") throw error;
      }
      const runId = text(f, "runId") || undefined;
      const { prepareSecretReveal: u } = await gw.gql(SecretPrepareRevealDocument, {
        fieldKey,
        runId,
        secretId: id,
      });
      log.info("secret reveal held for approval", {
        confirm: u.confirm,
        secretId: id,
        state: u.state,
        useId: u.id,
      });
      if (u.state === "APPROVED") {
        const r = await gw.gql(SecretRedeemRevealDocument, { id: u.id });
        return { fieldKey, value: r.redeemSecretReveal };
      }
      return {
        fieldKey,
        pendingUse: {
          confirm: u.confirm,
          expiresAt: u.expiresAtUnix * 1000,
          id: u.id,
          runId: u.runId ?? null,
        },
      };
    }
    case "reveal-collect": {
      const fieldKey = text(f, "fieldKey");
      const useId = text(f, "useId");
      try {
        const r = await gw.gql(SecretRedeemRevealDocument, { id: useId });
        return { fieldKey, value: r.redeemSecretReveal };
      } catch (error) {
        const refusal = refusalOf(error);
        if (refusal?.code !== "FAILED_PRECONDITION" || !refusal.detail.includes("PENDING"))
          throw error;
      }
      return {
        fieldKey,
        pendingUse: {
          confirm: text(f, "confirm") === "true",
          expiresAt: Number(text(f, "expiresAt")),
          id: useId,
          runId: text(f, "runId") || null,
        },
      };
    }
    case "reveal-version": {
      const fieldKey = text(f, "fieldKey");
      const versionNo = Number(text(f, "versionNo"));
      const r = await gw.gql(SecretRevealVersionDocument, { fieldKey, secretId: id, versionNo });
      return { fieldKey, value: r.revealSecretVersionField, versionNo };
    }
    case "rotate": {
      await gw.gql(SecretRotateDocument, { secretId: id });
      return { done: "Rotation started. The new value is set on the target." };
    }
    case "token-approval": {
      const level = text(f, "level") || (text(f, "required") === "true" ? "required" : "off");
      const r = await gw.gql(SecretSetTokenApprovalDocument, {
        always: level === "always",
        required: level !== "off",
        secretId: id,
      });
      const s = r.setSecretTokenApproval;
      return {
        done: s.alwaysRequireApproval
          ? "Every reveal now needs another owner's or an approver's approval, owners' too."
          : s.requireTokenApproval
            ? "Reveals by people who aren't owners now need an owner's approval."
            : "Reveals no longer need approval.",
      };
    }
  }
  throw invalid("desc = unknown action");
};

/**
 * A check-out blocking a restore names its holder by id; look the name up so the page can say
 * who to ask. A failed lookup leaves the refusal as it was.
 */
const withHolderName = async (
  gw: GatewayClient,
  refusal: Refusal,
  secretId: string,
): Promise<Refusal> => {
  const holder = refusal.metadata.holder_user_id;
  if (refusal.reason !== "CHECKOUT_LEASE_HELD" || !holder) return refusal;
  try {
    const { user } = await gw.gql(MeDocument, { id: holder });
    if (!user) return refusal;
    return { ...refusal, metadata: { ...refusal.metadata, holder_name: user.name } };
  } catch {
    log.warn("secret action: lease holder lookup failed", { holderId: holder, secretId });
    return refusal;
  }
};

/** One form on the page: a reveal, break glass, rotation, retirement, export and the rest. */
export const secretAction = async (request: Request, id: string): Promise<SecretActionResult> => {
  const { gw, user } = await requireUser(request);
  const f = await request.formData();
  const intent = text(f, "intent");
  const echo = {
    fieldKey: text(f, "fieldKey") || undefined,
    purpose: text(f, "purpose") || undefined,
    useId: text(f, "useId") || undefined,
    versionNo: f.has("versionNo") ? Number(text(f, "versionNo")) : undefined,
  };
  log.info("secret action", { fieldKey: echo.fieldKey, intent, secretId: id, userId: user.id });
  if (intent === "checkout" || intent === "checkin") {
    const r =
      intent === "checkout"
        ? await checkOut(request, id, text(f, "hours"))
        : await checkIn(request, id);
    if (!r.ok) return { ...echo, intent, ok: false, refusal: r.refusal };
    return {
      ...echo,
      done:
        intent === "checkout"
          ? `Checked out until ${clockTime(r.done)}.`
          : "Checked in. The password rotates to a new value.",
      intent,
      ok: true,
    };
  }
  return guard(request, async () => {
    try {
      const result = await run(gw, id, intent, f);
      if (result instanceof Response) {
        log.info("secret action: done", { intent, secretId: id, userId: user.id });
        throw result;
      }
      log.info("secret action: done", { intent, secretId: id, userId: user.id });
      return { ...echo, ...result, intent, ok: true as const };
    } catch (error) {
      if (error instanceof Response) throw error;
      const refused = refusalOf(error);
      if (!refused) {
        log.error("secret action failed", { intent, secretId: id, userId: user.id });
        throw error;
      }
      const refusal = await withHolderName(gw, refused, id);
      log.warn("secret action: refused", {
        code: refusal.code,
        intent,
        reason: refusal.reason,
        secretId: id,
        userId: user.id,
      });
      return { ...echo, intent, ok: false as const, refusal };
    }
  });
};
