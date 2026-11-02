import {
  createLogger,
  EditorsChangeSecretTypeDocument,
  type EditorsChangeSecretTypeMutation,
  EditorsPickersDocument,
  EditorsPreviewTypeChangeDocument,
  type EditorsPreviewTypeChangeQuery,
  EditorsSecretDocument,
  EditorsSecretFieldsDocument,
  type EditorsSecretQuery,
  type GatewayClient,
  type UnmappedFieldPolicy,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";

import type { Policy } from "@/features/editors/policy";
import type { SecretType } from "@/features/editors/validate";

import { type EditorLoad, failed, missing } from "@/features/editors/editors.server";
import { secretAction, type SecretActionResult } from "@/features/secret/secret.server";

const log = createLogger("staff.change-type");

export type ChangedType = EditorsChangeSecretTypeMutation["changeSecretType"];

export type ChangeTypeLoad = ChangeTypePage | Extract<EditorLoad, { ok: false }>;

export interface ChangeTypePage {
  ok: true;
  policies: Policy[];
  secret: { folderId: string; id: string; name: string; typeId: string };
  targets: { id: string; name: string }[];
  types: SecretType[];
  /** Non-sensitive stored values only, for Show on the review. Sensitive ones need a reveal. */
  values: Record<string, string>;
}

export type ChangeTypePreview = EditorsPreviewTypeChangeQuery["previewSecretTypeChange"];

export type ChangeTypeResult =
  | { changed: ChangedType; intent: "change"; ok: true }
  | { intent: "preview"; newTypeId: string; ok: true; preview: ChangeTypePreview }
  | { intent: string; ok: false; refusal: Refusal };

/** The change-type page: the secret, the types and how to draw their fields. Keys, not values. */
export const loadChangeType = async (request: Request, id: string): Promise<ChangeTypeLoad> => {
  const { gw, user } = await requireUser(request);
  const started = Date.now();
  log.debug("change type: loading", { secretId: id, userId: user.id });
  return guard(request, async () => {
    let found: EditorsSecretQuery;
    try {
      found = await gw.gql(EditorsSecretDocument, { id });
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal?.code === "NOT_FOUND") throw missing(id, refusal.code);
      return failed(error, { secretId: id, userId: user.id }) as Extract<EditorLoad, { ok: false }>;
    }
    const secret = found.secret;
    if (!secret) throw missing(id);
    try {
      const [p, fields] = await Promise.all([
        gw.gql(EditorsPickersDocument, {}),
        gw.gql(EditorsSecretFieldsDocument, { id }),
      ]);
      log.debug("change type: loaded", {
        ms: Date.now() - started,
        secretId: id,
        typeId: secret.typeId,
        userId: user.id,
      });
      return {
        ok: true as const,
        policies: p.passwordPolicies,
        secret: {
          folderId: secret.folderId,
          id: secret.id,
          name: secret.name,
          typeId: secret.typeId,
        },
        targets: p.targets.map(({ id: targetId, name }) => ({ id: targetId, name })),
        types: p.secretTypes,
        values: Object.fromEntries(fields.secretFields.map((f) => [f.key, f.value])),
      };
    } catch (error) {
      return failed(error, { secretId: id, userId: user.id }) as Extract<EditorLoad, { ok: false }>;
    }
  });
};

const text = (f: FormData, key: string) => String(f.get(key) ?? "");

const list = <T>(f: FormData, key: string): T[] => JSON.parse(text(f, key) || "[]") as T[];

/** The same arguments go to the preview and the change. `fields` holds values: never log it. */
const variablesOf = (f: FormData, id: string) => {
  const policy = text(f, "unmappedFields");
  return {
    fieldMapping: list<{ from: string; to: string }>(f, "fieldMapping"),
    fields: list<{ key: string; value: string }>(f, "fields"),
    id,
    newTypeId: text(f, "newTypeId"),
    unmappedFields: (policy || undefined) as undefined | UnmappedFieldPolicy,
  };
};

const run = async (
  gw: GatewayClient,
  intent: string,
  f: FormData,
  id: string,
  userId: string,
): Promise<ChangeTypeResult> => {
  const variables = variablesOf(f, id);
  const context = {
    fieldKeys: variables.fields.map((x) => x.key).join(","),
    mapping: variables.fieldMapping.map((m) => `${m.from}>${m.to}`).join(","),
    newTypeId: variables.newTypeId,
    secretId: id,
    userId,
  };
  if (intent === "preview") {
    const d = await gw.gql(EditorsPreviewTypeChangeDocument, variables);
    const preview = d.previewSecretTypeChange;
    log.debug("change type: previewed", {
      ...context,
      allowed: preview.allowed,
      reason: preview.refusalReason ?? "",
    });
    return { intent, newTypeId: variables.newTypeId, ok: true, preview };
  }
  if (intent === "change") {
    const d = await gw.gql(EditorsChangeSecretTypeDocument, variables);
    log.info("secret type changed", {
      ...context,
      movedToNotes: d.changeSecretType.movedToNotesKeys.join(","),
    });
    return { changed: d.changeSecretType, intent, ok: true };
  }
  return {
    intent,
    ok: false,
    refusal: { code: "INVALID_ARGUMENT", detail: "unknown action", metadata: {} },
  };
};

/** Reveals on the review go through the secret page's own path: audited, approval-aware. */
const REVEALS = new Set(["reveal", "reveal-collect"]);

export const changeTypeAction = async (
  request: Request,
  id: string,
): Promise<ChangeTypeResult | SecretActionResult> => {
  const peek = await request.clone().formData();
  const intent = text(peek, "intent");
  if (REVEALS.has(intent)) {
    log.debug("change type: reveal on the review", { intent, secretId: id });
    return secretAction(request, id);
  }
  const { gw, user } = await requireUser(request);
  const f = await request.formData();
  return guard(request, async () => {
    try {
      return await run(gw, intent, f, id, user.id);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("change type failed", { intent, secretId: id, userId: user.id });
        throw error;
      }
      log.warn("change type refused", {
        code: refusal.code,
        fields: refusal.metadata.fields ?? "",
        intent,
        reason: refusal.reason,
        secretId: id,
        userId: user.id,
      });
      return { intent, ok: false as const, refusal };
    }
  });
};
