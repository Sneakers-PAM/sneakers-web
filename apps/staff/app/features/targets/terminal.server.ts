import {
  createLogger,
  TargetsOpenSshSessionDocument,
  type TargetsOpenSshSessionMutation,
  TargetsTerminalDocument,
  TargetsTerminalFieldsDocument,
  type TargetsTerminalQuery,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";

const log = createLogger("terminal");

const SSH_KEY_TYPE = "type-ssh-key";
const SSH_PASSWORD_TYPE = "type-unix-ssh";
/** Secret types the web terminal can open a session for (#319). */
const SSH_TERMINAL_TYPES = new Set([SSH_KEY_TYPE, SSH_PASSWORD_TYPE]);

/** Whether the web terminal can open a session for a secret of this type. */
export const opensTerminal = (typeId: string): boolean => SSH_TERMINAL_TYPES.has(typeId);

/** Whether the secret's Open terminal can connect yet, and if not, why (#317). */
export type TerminalAvailability =
  { blocked: "no-target" | "not-ssh" | null } | { blocked: "not-pinned"; targetId: string };

/**
 * The secret's attached targets that connect over SSH, in attach order. A legacy secret
 * (targetIds empty) is read as a one-item list from the primary targetId, the same
 * normalize-on-read the vault itself does.
 */
const sshTargetsOf = (
  secret: NonNullable<TargetsTerminalQuery["secret"]>,
  d: Pick<TargetsTerminalQuery, "connections" | "targets">,
) => {
  const targetIds =
    secret.targetIds && secret.targetIds.length > 0
      ? secret.targetIds
      : [secret.targetId].filter((x): x is string => !!x);
  return {
    targetIds,
    usable: targetIds
      .map((tid) => d.targets.find((t) => t.id === tid))
      .filter((t): t is NonNullable<typeof t> => {
        if (!t) return false;
        return d.connections.find((c) => c.id === t.connectionId)?.protocol === "ssh";
      }),
  };
};

/**
 * Whether Open terminal can connect for an SSH secret, for the secret page to show the action
 * disabled with its reason instead of leaving it off. One usable target with a pinned host key
 * is enough; the terminal page picks among several.
 */
export const terminalAvailability = (d: TargetsTerminalQuery): TerminalAvailability => {
  if (!d.secret) return { blocked: "no-target" };
  const { targetIds, usable } = sshTargetsOf(d.secret, d);
  if (targetIds.length === 0) return { blocked: "no-target" };
  if (usable.length === 0) return { blocked: "not-ssh" };
  if (usable.some((t) => t.sshHostKeys.length > 0)) return { blocked: null };
  return { blocked: "not-pinned", targetId: usable[0]!.id };
};

export type OpenResult = { ok: false; refusal: Refusal } | { ok: true; ticket: SessionTicket };

export type SessionTicket = TargetsOpenSshSessionMutation["openSshSession"];

export interface TerminalData {
  secret: { id: string; name: string };
  session: TerminalSession;
}

/**
 * What the terminal can do for this secret: open a session to `hostname` as `username`, or
 * why not. `pinned` false means the broker will refuse the host (no pinned host key). `choose`
 * is #168: a secret attached to more than one usable target needs one picked before it's
 * "ready".
 */
export type TerminalSession =
  | {
      canPinHostKey: boolean;
      hostname: string;
      kind: "ready";
      pinned: boolean;
      targetId: string;
      username: string;
    }
  | { kind: "choose"; targets: { hostname: string; id: string; name: string }[] }
  | { kind: "locked" }
  | { kind: "not-ssh" }
  | { kind: "retired" };

/**
 * U-12: the secret, its SSH target and the username. The credential itself (the key for a
 * type-ssh-key secret, the password for a type-unix-ssh one) never leaves the vault; #319 added
 * the password kind. #168: a secret attached to several targets needs one picked (the `target`
 * search param) before it's ready; one usable target needs no picking.
 */
export const loadTerminal = async (request: Request, id: string): Promise<TerminalData> => {
  const { gw, user } = await requireUser(request);
  const wantedTargetId = new URL(request.url).searchParams.get("target")?.trim() || "";
  log.debug("terminal load", { secretId: id, targetId: wantedTargetId || undefined });
  return guard(request, async () => {
    const d = await gw.gql(TargetsTerminalDocument, { id });
    const s = d.secret;
    if (!s) {
      log.info("terminal: secret not found", { secretId: id });
      throw Response.json({ kind: "not-found" }, { status: 404 });
    }
    const secret = { id: s.id, name: s.name };
    if (!SSH_TERMINAL_TYPES.has(s.typeId)) {
      log.debug("terminal: not an SSH secret type", { secretId: id });
      return { secret, session: { kind: "not-ssh" } };
    }
    const { usable } = sshTargetsOf(s, d);
    if (usable.length === 0) {
      log.debug("terminal: no usable SSH target", { secretId: id });
      return { secret, session: { kind: "not-ssh" } };
    }
    if (s.retired) return { secret, session: { kind: "retired" } };
    if (s.canRead !== true) return { secret, session: { kind: "locked" } };
    const target = usable.length === 1 ? usable[0] : usable.find((t) => t.id === wantedTargetId);
    if (!target) {
      log.debug("terminal: choosing a target", { candidates: usable.length, secretId: id });
      return {
        secret,
        session: {
          kind: "choose",
          targets: usable.map((t) => ({ hostname: t.hostname, id: t.id, name: t.name })),
        },
      };
    }
    const f = await gw.gql(TargetsTerminalFieldsDocument, { id });
    const username = f.secretFields.find((x) => x.key === "username")?.value ?? "";
    log.debug("terminal ready", {
      pinned: target.sshHostKeys.length > 0,
      secretId: id,
      targetId: target.id,
    });
    return {
      secret,
      session: {
        canPinHostKey: isAdmin(user),
        hostname: target.hostname,
        kind: "ready",
        pinned: target.sshHostKeys.length > 0,
        targetId: target.id,
        username,
      },
    };
  });
};

/**
 * Ask the gateway for a session ticket (single use, short lived). The page connects with it
 * straight away; a reconnect asks again. The ticket is never logged, only the session id.
 */
export const terminalAction = async (request: Request, id: string): Promise<OpenResult> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent !== "open") {
    log.warn("unknown intent", { intent });
    throw new Response("Unknown intent", { status: 400 });
  }
  const targetId = String(form.get("targetId") ?? "").trim() || undefined;
  log.debug("ssh session open", { secretId: id, targetId });
  return guard(request, async () => {
    const started = Date.now();
    try {
      const { openSshSession } = await gw.gql(TargetsOpenSshSessionDocument, {
        secretId: id,
        targetId,
      });
      log.info("ssh session ticket issued", {
        durationMs: Date.now() - started,
        secretId: id,
        sessionId: openSshSession.sessionId,
      });
      return { ok: true, ticket: openSshSession };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("ssh session open failed", { error: String(error), secretId: id });
        throw error;
      }
      log.info("ssh session refused", { code: refusal.code, reason: refusal.reason, secretId: id });
      return { ok: false, refusal };
    }
  });
};
