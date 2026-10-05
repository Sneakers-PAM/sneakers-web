import {
  AgentsDecideUsesDocument,
  AgentsUseRunDocument,
  type FactorInput,
  type SecretUseRefusal,
} from "@sneakers-web/api-client";
import { HttpResponse, type RequestHandler } from "msw";

import type { MockSecretUse } from "#mock/fixtures/world";

import { refusal } from "#mock/admin/refuse";
import { WRONG_CODE } from "#mock/fixtures/users";
import { authed } from "#mock/handlers/auth";
import { api, asUser } from "#mock/handlers/graphql";
import { MOCK_MFA_MAX_AGE_MS } from "#mock/handlers/stepUp";
import { mockState } from "#mock/state";

// The gateway's batch cap, and the vault's window to redeem an approved use.
const MAX_BATCH = 20;
const REDEEM_AFTER_APPROVAL_S = 60;

const world = () => mockState.world;
const nowUnix = () => Math.floor(Date.now() / 1000);
const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

/** A pending or approved use past its time is expired, as the vault marks it on read. */
const sweep = () => {
  const now = nowUnix();
  for (const u of world().secretUses) {
    if ((u.state === "pending" || u.state === "approved") && now >= u.expiresAtUnix)
      u.state = "expired";
  }
};

/** The token's name, else the client label, as the gateway names a use's requester. */
const requester = (u: MockSecretUse) =>
  world().tokens.find((t) => t.id === u.tokenId)?.label || u.clientLabel;

const runUseView = (u: MockSecretUse) => ({
  argv: [...u.argv],
  clientLabel: u.clientLabel,
  expiresAtUnix: u.expiresAtUnix,
  fieldKey: u.fieldKey,
  id: u.id,
  purpose: u.purpose ?? "",
  requester: requester(u),
  reveal: u.reveal,
  runId: u.runId ?? null,
  secretName: u.secretName,
  state: u.state.toUpperCase(),
});

/** When the session's step-up stops covering an approval (unix seconds), or 0. */
const freshUntilUnix = (request: Request): number => {
  const at = authed(request)?.mfaVerifiedAt;
  if (at === undefined || Date.now() - at >= MOCK_MFA_MAX_AGE_MS) return 0;
  return Math.floor((at + MOCK_MFA_MAX_AGE_MS) / 1000);
};

const factorOk = (f: FactorInput) =>
  (f.kind === "totp" || f.kind === "email") &&
  /^\d{6}$/.test(f.code ?? "") &&
  f.code !== WRONG_CODE;

/** Like the vault's DecideSecretUse for one id, with the gateway's mapping of its refusals. */
const decideOne = (
  userId: string,
  id: string,
  approve: boolean,
): { reason: SecretUseRefusal; use?: undefined } | { reason?: undefined; use: MockSecretUse } => {
  const u = world().secretUses.find((x) => x.id === id);
  if (!u) return { reason: "NOT_FOUND" };
  if (u.ownerUserId !== userId) return { reason: "NOT_PERMITTED" };
  if (u.state === "expired") return { reason: "EXPIRED" };
  if (u.state !== "pending") return { reason: "ALREADY_DECIDED" };
  if (approve) {
    u.state = "approved";
    u.expiresAtUnix = nowUnix() + REDEEM_AFTER_APPROVAL_S;
  } else {
    u.state = "denied";
  }
  return { use: u };
};

/** Mock answers for an agent run's approval page: list the run, then decide a batch of it. */
export const agentRunsHandlers: RequestHandler[] = [
  api.query(AgentsUseRunDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      sweep();
      return ok({
        secretUseRun: {
          mfaFreshUntilUnix: freshUntilUnix(request),
          runId: variables.runId,
          uses: world()
            .secretUses.filter(
              (u) =>
                u.ownerUserId === userId && u.state === "pending" && u.runId === variables.runId,
            )
            .map((u) => runUseView(u)),
        },
      });
    }),
  ),

  api.mutation(AgentsDecideUsesDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const ids = [...new Set(variables.ids)];
      if (ids.length === 0 || ids.length > MAX_BATCH)
        return refusal(
          "INVALID_ARGUMENT",
          "decide 1 to 20 secret uses at a time",
          "BATCH_SIZE_INVALID",
        );
      const approve = variables.decision === "APPROVE";
      if (approve) {
        const { factor } = variables;
        if (!factor && freshUntilUnix(request) === 0)
          return refusal(
            "FAILED_PRECONDITION",
            "a fresh second factor is required",
            "STEP_UP_REQUIRED",
          );
        if (factor && !factorOk(factor))
          return refusal(
            "UNAUTHENTICATED",
            "second factor was not accepted",
            "FACTOR_NOT_ACCEPTED",
          );
      }
      sweep();
      return ok({
        decideSecretUses: {
          outcomes: ids.map((id) => {
            const r = decideOne(userId, id, approve);
            return r.use
              ? { decided: true, id, reason: null, use: runUseView(r.use) }
              : { decided: false, id, reason: r.reason, use: null };
          }),
        },
      });
    }),
  ),
];
