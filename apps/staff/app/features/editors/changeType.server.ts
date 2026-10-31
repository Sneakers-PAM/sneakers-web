import {
  createLogger,
  EditorsChangeSecretTypeDocument,
  type EditorsChangeSecretTypeMutation,
  EditorsPickersDocument,
  EditorsPreviewTypeChangeDocument,
  type EditorsPreviewTypeChangeQuery,
  type GatewayClient,
  type UnmappedFieldPolicy,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";

import type { Policy } from "@/features/editors/policy";
import type { SecretType } from "@/features/editors/validate";

const log = createLogger("staff.change-type");

export type ChangedType = EditorsChangeSecretTypeMutation["changeSecretType"];
export type ChangeTypeChoices =
  | { ok: false; refusal: Refusal }
  | {
      ok: true;
      policies: Policy[];
      targets: { id: string; name: string }[];
      types: SecretType[];
    };

export type ChangeTypePreview = EditorsPreviewTypeChangeQuery["previewSecretTypeChange"];

export type ChangeTypeResult =
  | { changed: ChangedType; intent: "change"; ok: true }
  | { intent: "preview"; ok: true; preview: ChangeTypePreview }
  | { intent: string; ok: false; refusal: Refusal };

/** What the dialog needs before anything is previewed: the types and how to draw their fields. */
export const loadChangeType = async (request: Request): Promise<ChangeTypeChoices> => {
  const { gw } = await requireUser(request);
  return guard(request, async () => {
    try {
      const d = await gw.gql(EditorsPickersDocument, {});
      return {
        ok: true as const,
        policies: d.passwordPolicies,
        targets: d.targets.map(({ id, name }) => ({ id, name })),
        types: d.secretTypes,
      };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      log.warn("change type: choices refused", { code: refusal.code, reason: refusal.reason });
      return { ok: false as const, refusal };
    }
  });
};

const text = (f: FormData, key: string) => String(f.get(key) ?? "");

const list = <T>(f: FormData, key: string): T[] => JSON.parse(text(f, key) || "[]") as T[];

/** The same arguments go to the preview and the change. `fields` holds values: never log it. */
const variablesOf = (f: FormData) => {
  const policy = text(f, "unmappedFields");
  return {
    fieldMapping: list<{ from: string; to: string }>(f, "fieldMapping"),
    fields: list<{ key: string; value: string }>(f, "fields"),
    id: text(f, "id"),
    newTypeId: text(f, "newTypeId"),
    unmappedFields: (policy || undefined) as undefined | UnmappedFieldPolicy,
  };
};

const run = async (
  gw: GatewayClient,
  intent: string,
  f: FormData,
  userId: string,
): Promise<ChangeTypeResult> => {
  const variables = variablesOf(f);
  const context = { newTypeId: variables.newTypeId, secretId: variables.id, userId };
  if (intent === "preview") {
    const d = await gw.gql(EditorsPreviewTypeChangeDocument, variables);
    const preview = d.previewSecretTypeChange;
    log.debug("change type: previewed", {
      ...context,
      allowed: preview.allowed,
      reason: preview.refusalReason ?? "",
    });
    return { intent, ok: true, preview };
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

export const changeTypeAction = async (request: Request): Promise<ChangeTypeResult> => {
  const { gw, user } = await requireUser(request);
  const f = await request.formData();
  const intent = text(f, "intent");
  return guard(request, async () => {
    try {
      return await run(gw, intent, f, user.id);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("change type failed", { intent, secretId: text(f, "id"), userId: user.id });
        throw error;
      }
      log.warn("change type refused", {
        code: refusal.code,
        fields: refusal.metadata.fields ?? "",
        intent,
        reason: refusal.reason,
        secretId: text(f, "id"),
        userId: user.id,
      });
      return { intent, ok: false as const, refusal };
    }
  });
};
