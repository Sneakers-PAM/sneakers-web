import {
  AgentsBeginFactorPasskeyDocument,
  AgentsCreateGrantDocument,
  AgentsDecideUseDocument,
  AgentsGrantsDocument,
  AgentsPendingUsesDocument,
  AgentsRevokeGrantDocument,
  AgentsRevokeTokenDocument,
  AgentsSendFactorEmailDocument,
  AgentsTokensDocument,
  type AgentsUseFieldsFragment,
  createLogger,
  type FactorInput,
  type GatewayClient,
  type UseGrantInput,
} from "@sneakers-web/api-client";
import { refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";

import { agentRefusalMessage } from "@/features/agents/messages";
import {
  type AgentsResult,
  DEFAULT_GRANT_FIELD,
  type FolderChoice,
  folderPath,
  type GrantRow,
  grantState,
  programText,
  type SecretChoice,
  type TokenChoice,
  type TokenRow,
  tokenState,
  type UseRow,
  usesText,
} from "@/features/agents/model";

const log = createLogger("agents");

const nowUnix = () => Math.floor(Date.now() / 1000);
const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
const list = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

type Work = (
  gw: GatewayClient,
) => Promise<Omit<Extract<AgentsResult, { ok: true }>, "intent" | "ok">>;

/**
 * Run one form intent as the signed-in user. A refusal comes back as data with its sentence,
 * so the page can say what went wrong; session trouble still goes to sign-in.
 */
const act = async (request: Request, intent: string, work: Work): Promise<AgentsResult> => {
  const { gw } = await requireUser(request);
  log.debug("action", { intent });
  return guard(request, async () => {
    try {
      const done = await work(gw);
      log.info("action done", { intent });
      return { ...done, intent, ok: true as const };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("action failed", { error: String(error), intent });
        throw error;
      }
      log.info("action refused", { code: refusal.code, intent, reason: refusal.reason });
      return {
        factorRejected: !refusal.code && !refusal.reason,
        intent,
        message: agentRefusalMessage(refusal),
        ok: false as const,
        refusal,
      };
    }
  });
};

/** The second factor a form carries: a code (totp or email) or a passkey assertion. */
const factorFrom = (form: FormData): FactorInput => {
  const kind = field(form, "factor");
  if (kind === "passkey") {
    return {
      credentialJson: String(form.get("credentialJson") ?? ""),
      kind,
      webauthnSessionId: field(form, "webauthnSessionId"),
    };
  }
  return {
    code: field(form, "code").replaceAll(/\D/g, ""),
    kind: kind === "email" ? "email" : "totp",
  };
};

/** The factor prompt's own steps, shared by the approvals and grants actions. */
const factorStep = (request: Request, intent: string): null | Promise<AgentsResult> => {
  if (intent === "factor-email") {
    return act(request, intent, async (gw) => {
      await gw.gql(AgentsSendFactorEmailDocument);
      return { done: "sent" };
    });
  }
  if (intent === "factor-passkey") {
    return act(request, intent, async (gw) => {
      const { beginMfaPasskey } = await gw.gql(AgentsBeginFactorPasskeyDocument);
      return { done: "passkey", passkey: beginMfaPasskey };
    });
  }
  return null;
};

const unknownIntent = (intent: string): never => {
  log.warn("unknown intent", { intent });
  throw new Response("Unknown intent", { status: 400 });
};

/** U-13: the user's personal tokens, newest first, and where an agent connects. */
export const loadTokens = async (
  request: Request,
): Promise<{ mcpUrl: null | string; tokens: TokenRow[] }> => {
  const { gw } = await requireUser(request);
  log.debug("tokens load");
  return guard(request, async () => {
    const { myTokens } = await gw.gql(AgentsTokensDocument);
    const now = nowUnix();
    const tokens = myTokens
      .map((t) => ({
        app: t.clientName,
        createdAt: t.createdAtUnix * 1000,
        id: t.id,
        label: t.label,
        lastUsedAt: t.lastUsedAtUnix ? t.lastUsedAtUnix * 1000 : null,
        state: tokenState(t, now),
      }))
      .toSorted((a, b) => b.createdAt - a.createdAt);
    log.debug("tokens loaded", { count: tokens.length });
    return { mcpUrl: process.env.MCP_URL?.trim() || null, tokens };
  });
};

/** `revoke` by `id`. */
export const tokensAction = async (request: Request): Promise<AgentsResult> => {
  const form = await request.formData();
  const intent = field(form, "intent");
  if (intent !== "revoke") return unknownIntent(intent);
  return act(request, intent, async (gw) => {
    const { revokeMyToken } = await gw.gql(AgentsRevokeTokenDocument, { id: field(form, "id") });
    return { done: `${revokeMyToken.label || "The token"} is revoked.` };
  });
};

const useRows = (uses: AgentsUseFieldsFragment[]): UseRow[] =>
  uses
    .map((u) => ({
      clientLabel: u.clientLabel,
      command: u.reveal ? "" : u.argv.join(" "),
      confirm: u.confirm,
      expiresAt: u.expiresAtUnix * 1000,
      fieldKey: u.fieldKey,
      id: u.id,
      requestedBy: u.requestedBy,
      reveal: u.reveal,
      runId: u.runId ?? null,
      secretName: u.secretName,
    }))
    .toSorted((a, b) => a.expiresAt - b.expiresAt);

/**
 * U-14: other people's uses the user may decide (as an owner or approver of the secret), and
 * the user's own uses still waiting, soonest to expire first.
 */
export const loadApprovals = async (
  request: Request,
): Promise<{ mine: UseRow[]; toDecide: UseRow[] }> => {
  const { gw } = await requireUser(request);
  log.debug("approvals load");
  return guard(request, async () => {
    const { pendingSecretUses, secretUsesToDecide } = await gw.gql(AgentsPendingUsesDocument);
    const toDecide = useRows(secretUsesToDecide);
    const mine = useRows(pendingSecretUses);
    log.debug("approvals loaded", { mine: mine.length, toDecide: toDecide.length });
    return { mine, toDecide };
  });
};

/**
 * `approve` (with the factor) and `deny` someone else's use by `id`, `withdraw` one of the
 * user's own, plus the factor prompt's steps.
 */
export const approvalsAction = async (request: Request): Promise<AgentsResult> => {
  const form = await request.formData();
  const intent = field(form, "intent");
  const step = factorStep(request, intent);
  if (step) return step;
  if (intent !== "approve" && intent !== "deny" && intent !== "withdraw")
    return unknownIntent(intent);
  const approve = intent === "approve";
  return act(request, intent, async (gw) => {
    const { decideSecretUse: u } = await gw.gql(AgentsDecideUseDocument, {
      approve,
      factor: approve ? factorFrom(form) : undefined,
      id: field(form, "id"),
    });
    if (intent === "withdraw") return { done: "Withdrawn. Nobody needs to decide it now." };
    if (!approve) return { done: "Denied. The request was refused." };
    return {
      done: u.reveal
        ? `${u.secretName} goes to the agent once. This is logged.`
        : `Approved. The value goes to ${u.argv[0] ?? "the command"} once.`,
    };
  });
};

/** U-15: the grants, the active tokens a new one can name, and what it can cover. */
export const loadGrants = async (
  request: Request,
): Promise<{
  folders: FolderChoice[];
  grants: GrantRow[];
  secrets: SecretChoice[];
  tokens: TokenChoice[];
}> => {
  const { gw } = await requireUser(request);
  log.debug("grants load");
  return guard(request, async () => {
    const d = await gw.gql(AgentsGrantsDocument);
    const now = nowUnix();
    const folderMap = new Map(d.folders.map((f) => [f.id, f]));
    const types = new Map(d.secretTypes.map((t) => [t.id, t]));
    const secrets = d.secretsByStatus
      .map((s) => ({
        fields: (types.get(s.typeId)?.fields ?? []).filter((f) => f.sensitive).map((f) => f.key),
        id: s.id,
        name: s.name,
        path: folderPath(s.folderId, folderMap),
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name));
    const secretName = new Map(secrets.map((s) => [s.id, s.name]));
    const tokenLabel = new Map(d.myTokens.map((t) => [t.id, t.label || t.clientName]));
    const grants = d.useGrants
      .map((g) => ({
        endsAt: g.expiresAtUnix * 1000,
        fields: (g.fieldKeys.length > 0 ? g.fieldKeys : [DEFAULT_GRANT_FIELD]).join(", "),
        id: g.id,
        programs: g.programs.map((p) => programText(p)),
        reveal: g.allowReveal,
        scope: g.folderId
          ? `Folder: ${folderPath(g.folderId, folderMap) || "one you can't see"}`
          : g.secretIds.map((id) => secretName.get(id) ?? "A secret you can't see").join(", "),
        state: grantState(g, now),
        token: tokenLabel.get(g.tokenId) ?? "A token you no longer have",
        uses: usesText(g.uses, g.maxUses),
      }))
      .toSorted(
        (a, b) =>
          Number(b.state === "active") - Number(a.state === "active") || b.endsAt - a.endsAt,
      );
    const tokens = d.myTokens
      .filter((t) => tokenState(t, now) === "active")
      .map((t) => ({ app: t.clientName, id: t.id, label: t.label || t.clientName }));
    const folders = d.folders
      .map((f) => ({ id: f.id, path: folderPath(f.id, folderMap) }))
      .toSorted((a, b) => a.path.localeCompare(b.path));
    log.debug("grants loaded", { count: grants.length });
    return { folders, grants, secrets, tokens };
  });
};

const programsFrom = (raw: string): UseGrantInput["programs"] => {
  let rows: unknown;
  try {
    rows = JSON.parse(raw || "[]");
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: { argPattern?: unknown; program?: unknown }) => ({
      argPattern: String(r.argPattern ?? "").trim() || "*",
      program: String(r.program ?? "").trim(),
    }))
    .filter((p) => p.program !== "");
};

const grantInputFrom = (form: FormData): UseGrantInput => {
  const hours = Number(field(form, "hours"));
  const maxUses = field(form, "maxUses");
  const input: UseGrantInput = {
    allowReveal: field(form, "allowReveal") === "true",
    expiresAtUnix: nowUnix() + Math.round((Number.isFinite(hours) ? hours : 0) * 3600),
    programs: programsFrom(field(form, "programs")),
    tokenId: field(form, "tokenId"),
  };
  if (field(form, "scope") === "folder") input.folderId = field(form, "folderId");
  else input.secretIds = list(field(form, "secretIds"));
  const keys = list(field(form, "fieldKeys"));
  if (keys.length > 0) input.fieldKeys = keys;
  if (/^\d+$/.test(maxUses) && Number(maxUses) > 0) input.maxUses = Number(maxUses);
  return input;
};

/** `create` (the form, with the factor) and `revoke` by `id`, plus the factor prompt's steps. */
export const grantsAction = async (request: Request): Promise<AgentsResult> => {
  const form = await request.formData();
  const intent = field(form, "intent");
  const step = factorStep(request, intent);
  if (step) return step;
  if (intent === "create") {
    return act(request, intent, async (gw) => {
      const input = grantInputFrom(form);
      log.debug("grant create", {
        programs: input.programs.length,
        scope: input.folderId ? "folder" : "secrets",
        tokenId: input.tokenId,
      });
      await gw.gql(AgentsCreateGrantDocument, { factor: factorFrom(form), input });
      return { done: "Grant created. It runs without asking until it ends." };
    });
  }
  if (intent === "revoke") {
    return act(request, intent, async (gw) => {
      await gw.gql(AgentsRevokeGrantDocument, { id: field(form, "id") });
      return { done: "Grant revoked." };
    });
  }
  return unknownIntent(intent);
};
