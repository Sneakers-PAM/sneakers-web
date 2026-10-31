import type { RequestHandler } from "msw";

import {
  EditorsChangeSecretTypeDocument,
  EditorsPreviewTypeChangeDocument,
  type EditorsPreviewTypeChangeQueryVariables,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockSecret, MockSecretType } from "#mock/fixtures/world";

import { refusal } from "#mock/admin/refuse";
import { userById } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { canApprove, canSee, secretById } from "#mock/handlers/staff/access";
import { mockState } from "#mock/state";

/*
 * The vault's type change (sneakers-vault docs/type-change.md): every non-empty value lands in a
 * field of the new type or in its notes field, sensitivity never drops, and the preview runs the
 * same rules and writes nothing. A preview carries keys, never values.
 */

type Field = MockSecretType["fields"][number];

interface Inputs {
  extra: Record<string, string>;
  mapping: Record<string, string>;
  policy: null | string | undefined;
}

interface Refused {
  code: string;
  fields: string[];
  message: string;
  reason: string;
}

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;
const typeById = (id: string) => mockState.world.secretTypes.find((t) => t.id === id);
const fieldOf = (t: MockSecretType, key: string) => t.fields.find((f) => f.key === key);
const sensitive = (f: Field) =>
  f.kind === "password" || f.kind === "sensitive" || !!f.sensitive || !!f.superSensitive;

/** A stored key the old type doesn't declare counts as sensitive, as in the vault. */
const lowers = (from: Field | undefined, to: Field) => {
  if (!from) return !sensitive(to);
  return (sensitive(from) && !sensitive(to)) || (!!from.superSensitive && !to.superSensitive);
};

const notesKey = (t: MockSecretType) => ["notes", "note"].find((k) => fieldOf(t, k)) ?? "";
const TARGET_TYPES = new Set(["type-ssh-key", "type-unix-ssh"]);

const refuse = (code: string, reason: string, message: string, fields: string[]): Refused => ({
  code,
  fields,
  message,
  reason,
});

const evaluate = (s: MockSecret, st: MockSecretType, nt: MockSecretType, input: Inputs) => {
  const nk = notesKey(nt);
  const out: Record<string, string> = {};
  const changes: {
    fromKey: string;
    outcome: string;
    reason: null | string;
    toKey: null | string;
  }[] = [];
  const moved: string[] = [];
  const unmapped: string[] = [];
  const lowered: string[] = [];
  const sources = new Map<string, string>();
  let duplicate: Refused | undefined;
  const blocked = (fromKey: string, toKey: null | string, reason: string) =>
    changes.push({ fromKey, outcome: "blocked", reason, toKey });

  for (const from of Object.keys(s.fields).toSorted()) {
    const value = s.fields[from];
    if (!value) continue;
    const to = input.mapping[from] ?? from;
    const target = fieldOf(nt, to);
    if (!target) {
      unmapped.push(from);
      if (input.policy === "refuse" || !nk) blocked(from, null, "TYPE_CHANGE_UNMAPPED_FIELDS");
      else if (lowers(fieldOf(st, from), fieldOf(nt, nk) as Field)) {
        lowered.push(from);
        blocked(from, null, "TYPE_CHANGE_LOWERS_PROTECTION");
      } else {
        moved.push(from);
        changes.push({ fromKey: from, outcome: "movedToNotes", reason: null, toKey: nk });
      }
      continue;
    }
    const earlier = sources.get(to);
    if (earlier) {
      blocked(from, to, "TYPE_CHANGE_INVALID_FIELD");
      duplicate = refuse(
        "INVALID_ARGUMENT",
        "TYPE_CHANGE_INVALID_FIELD",
        `fields "${earlier}" and "${from}" both map to "${to}"`,
        [earlier, from, to],
      );
      continue;
    }
    sources.set(to, from);
    if (lowers(fieldOf(st, from), target)) {
      lowered.push(from);
      blocked(from, to, "TYPE_CHANGE_LOWERS_PROTECTION");
      continue;
    }
    out[to] = value;
    changes.push({
      fromKey: from,
      outcome: to === from ? "carried" : "renamed",
      reason: null,
      toKey: to,
    });
  }

  for (const [key, value] of Object.entries(input.extra)) {
    if (!out[key] && value) out[key] = value;
  }
  const missing = nt.fields
    .filter((f) => f.required && !out[f.key] && !changes.some((c) => c.toKey === f.key))
    .map((f) => f.key);

  let refused: Refused | undefined = duplicate;
  if (!refused && input.policy === "refuse" && unmapped.length > 0) {
    refused = refuse(
      "FAILED_PRECONDITION",
      "TYPE_CHANGE_UNMAPPED_FIELDS",
      `type change would drop the value of field(s) ${unmapped.join(", ")}`,
      unmapped,
    );
  }
  if (!refused && lowered.length > 0) {
    refused = refuse(
      "FAILED_PRECONDITION",
      "TYPE_CHANGE_LOWERS_PROTECTION",
      `type change would lower field protection: ${lowered.join(", ")}`,
      lowered,
    );
  }
  if (!refused && unmapped.length > 0 && !nk) {
    refused = refuse(
      "FAILED_PRECONDITION",
      "TYPE_CHANGE_UNMAPPED_FIELDS",
      `type change would drop the value of field(s) ${unmapped.join(", ")}`,
      unmapped,
    );
  }
  const firstMissing = missing[0];
  if (!refused && firstMissing) {
    refused = refuse(
      "INVALID_ARGUMENT",
      "FIELD_VALUE_REQUIRED",
      `${fieldOf(nt, firstMissing)?.label ?? firstMissing} is required`,
      [firstMissing],
    );
  }
  if (!refused && moved.length > 0) {
    const lines = moved.map((k) => `[moved from ${k}]: ${JSON.stringify(s.fields[k])}`);
    out[nk] = [out[nk], ...lines].filter(Boolean).join("\n");
  }

  const added = Object.keys(out).filter((k) => !s.fields[k] && !moved.includes(k));
  const carried = changes.filter((c) => c.outcome === "carried").map((c) => c.fromKey);
  const label = [
    `Type changed: ${st.name} -> ${nt.name}`,
    added.length > 0 ? `added ${added.join(", ")}` : "",
    carried.length > 0 ? `fields carried over: ${carried.join(", ")}` : "",
    moved.length > 0 ? `moved to notes: ${moved.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const takesTarget = !!nt.rotation || !!nt.heartbeat || TARGET_TYPES.has(nt.id);
  const heartbeat = () => {
    if (!nt.heartbeat) return "none";
    if (s.heartbeatOptOut) return "opted_out";
    return s.targetId && takesTarget ? "scheduled" : "no_target";
  };
  const target = () => {
    if (!s.targetId) return "none";
    return takesTarget ? "kept" : "detached";
  };
  return {
    changes,
    heartbeat: heartbeat(),
    label,
    missing,
    moved,
    nk: moved.length > 0 ? nk : "",
    out,
    refused,
    rotation: nt.rotation ? "off" : "none",
    target: target(),
  };
};

type Variables = EditorsPreviewTypeChangeQueryVariables;
const listOf = <T>(v: null | T | T[] | undefined): T[] => (v ? ([v].flat() as T[]) : []);

const prepare = (userId: string, variables: Variables) => {
  const s = secretById(variables.id);
  if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
  if (!canApprove(userId, s))
    return refusal("PERMISSION_DENIED", "not permitted to change the type of this secret");
  if (s.retired) return refusal("FAILED_PRECONDITION", "secret is retired", "RETIRED");
  const nt = typeById(variables.newTypeId);
  const st = typeById(s.typeId);
  if (!nt || !st) return refusal("NOT_FOUND", "secret type not found");
  if (nt.id === st.id) return refusal("INVALID_ARGUMENT", "secret already has that type");
  return {
    nt,
    result: evaluate(s, st, nt, {
      extra: Object.fromEntries(listOf(variables.fields).map((f) => [f.key, f.value])),
      mapping: Object.fromEntries(listOf(variables.fieldMapping).map((m) => [m.from, m.to])),
      policy: variables.unmappedFields,
    }),
    s,
  };
};

export const changeTypeHandlers: RequestHandler[] = [
  api.query(EditorsPreviewTypeChangeDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const ready = prepare(userId, variables);
      if (ready instanceof Response) return ready as never;
      const { result: r, s } = ready;
      return ok({
        previewSecretTypeChange: {
          allowed: !r.refused,
          changeLabel: r.refused ? null : r.label,
          fieldChanges: r.changes,
          fieldKeys: r.refused ? [] : Object.keys(r.out).toSorted(),
          fromTargetId: r.target === "detached" ? (s.targetId ?? null) : null,
          heartbeat: r.heartbeat,
          missingRequiredKeys: r.missing,
          notesFieldKey: r.nk || null,
          refusalMessage: r.refused?.message ?? null,
          refusalReason: r.refused?.reason ?? null,
          rotation: r.rotation,
          target: r.target,
          targetId: r.target === "kept" ? (s.targetId ?? null) : null,
        },
      });
    }),
  ),

  api.mutation(EditorsChangeSecretTypeDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const ready = prepare(userId, variables);
      if (ready instanceof Response) return ready as never;
      const { nt, result: r, s } = ready;
      if (r.refused) {
        return refusal(r.refused.code, r.refused.message, r.refused.reason, {
          fields: r.refused.fields.join(","),
        });
      }
      const versionNo = Math.max(0, ...s.versions.map((v) => v.versionNo)) + 1;
      for (const v of s.versions) v.active = false;
      s.versions.unshift({
        active: true,
        changedFieldKeys: Object.keys(r.out),
        changeLabel: r.label,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        createdByName: userById(userId)?.name ?? userId,
        fieldKeys: Object.keys(r.out),
        versionNo,
      });
      s.fields = r.out;
      s.typeId = nt.id;
      if (nt.rotation) s.rotationOptOut = true;
      if (r.target === "detached") {
        s.targetId = undefined;
        s.targetIds = undefined;
      }
      return ok({
        changeSecretType: {
          changeLabel: r.label,
          fieldKeys: Object.keys(r.out).toSorted(),
          movedToNotesKeys: r.moved,
          notesFieldKey: r.nk || null,
          secret: {
            id: s.id,
            rotationOptOut: s.rotationOptOut,
            targetIds: s.targetId ? [s.targetId] : [],
            typeId: s.typeId,
          },
        },
      });
    }),
  ),
];
