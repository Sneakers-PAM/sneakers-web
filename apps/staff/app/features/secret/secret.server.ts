import {
  ApiError,
  createLogger,
  type GatewayClient,
  GraphQLRequestError,
  SecretAccessDocument,
  type SecretAccessQuery,
  SecretBreakGlassDocument,
  SecretDeleteDocument,
  SecretDetailDocument,
  type SecretDetailFieldsFragment,
  type SecretDetailQuery,
  SecretExportCertificateDocument,
  SecretFieldsDocument,
  SecretReplaceCertificateDocument,
  SecretRestoreDocument,
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
import { data, redirect } from "react-router";

const log = createLogger("staff.secret");

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
  /** Null when the person isn't shown the history (owners and site admins are). */
  history: null | SecretVersion[];
  isAdmin: boolean;
  /** When the server answered, so "expires in" and "next rotation" read the same on both sides. */
  now: number;
  ok: true;
  secret: SecretView;
  target: { hostname: string; id: string; name: string } | null;
  type: null | SecretType;
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
  const [fields, history] = await Promise.all([
    access.read ? gw.gql(SecretFieldsDocument, { id }) : null,
    access.read && (access.manage || admin)
      ? gw.gql(SecretVersionsDocument, { secretId: id })
      : null,
  ]);
  return {
    access,
    fields: Object.fromEntries((fields?.secretFields ?? []).map((f) => [f.key, f.value])),
    folderPath: pathTo(detail.folders, secret.folderId),
    history: history?.secretVersions ?? null,
    isAdmin: admin,
    now: Date.now(),
    ok: true,
    secret,
    target: detail.targets.find((t) => t.id === secret.targetId) ?? null,
    type: detail.secretTypes.find((t) => t.id === secret.typeId) ?? null,
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
      purpose?: string;
      value?: string;
      versionNo?: number;
    }
  | {
      fieldKey?: string;
      intent: string;
      ok: false;
      purpose?: string;
      refusal: Refusal;
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
    case "retire": {
      const r = await gw.gql(SecretRetireDocument, { id });
      return { done: `${r.retireSecret.name} retired.` };
    }
    case "reveal": {
      const fieldKey = text(f, "fieldKey");
      const r = await gw.gql(SecretRevealDocument, { fieldKey, id });
      return { fieldKey, value: r.revealSecretField };
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
      const r = await gw.gql(SecretSetTokenApprovalDocument, {
        required: text(f, "required") === "true",
        secretId: id,
      });
      return {
        done: r.setSecretTokenApproval.requireTokenApproval
          ? "Agent reveals now need your approval."
          : "Agent reveals no longer need your approval.",
      };
    }
  }
  throw invalid("desc = unknown action");
};

/** One form on the page: a reveal, break glass, rotation, retirement, export and the rest. */
export const secretAction = async (request: Request, id: string): Promise<SecretActionResult> => {
  const { gw, user } = await requireUser(request);
  const f = await request.formData();
  const intent = text(f, "intent");
  const echo = {
    fieldKey: text(f, "fieldKey") || undefined,
    purpose: text(f, "purpose") || undefined,
    versionNo: f.has("versionNo") ? Number(text(f, "versionNo")) : undefined,
  };
  log.info("secret action", { fieldKey: echo.fieldKey, intent, secretId: id, userId: user.id });
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
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("secret action failed", { intent, secretId: id, userId: user.id });
        throw error;
      }
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
