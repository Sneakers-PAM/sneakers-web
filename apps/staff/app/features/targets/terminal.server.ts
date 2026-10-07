import {
  createLogger,
  TargetsOpenSshSessionDocument,
  type TargetsOpenSshSessionMutation,
  TargetsTerminalDocument,
  TargetsTerminalFieldsDocument,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";

const log = createLogger("terminal");

const SSH_KEY_TYPE = "type-ssh-key";

export type OpenResult = { ok: false; refusal: Refusal } | { ok: true; ticket: SessionTicket };

export type SessionTicket = TargetsOpenSshSessionMutation["openSshSession"];

export interface TerminalData {
  secret: { id: string; name: string };
  session: TerminalSession;
}

/**
 * What the terminal can do for this secret: open a session to `hostname` as `username`, or
 * why not. `pinned` false means the broker will refuse the host (no pinned host key).
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
  | { kind: "locked" }
  | { kind: "not-ssh" }
  | { kind: "retired" };

/** U-12: the secret, its SSH target and the username. The key itself never leaves the vault. */
export const loadTerminal = async (request: Request, id: string): Promise<TerminalData> => {
  const { gw, user } = await requireUser(request);
  log.debug("terminal load", { secretId: id });
  return guard(request, async () => {
    const d = await gw.gql(TargetsTerminalDocument, { id });
    const s = d.secret;
    if (!s) {
      log.info("terminal: secret not found", { secretId: id });
      throw Response.json({ kind: "not-found" }, { status: 404 });
    }
    const secret = { id: s.id, name: s.name };
    const target = d.targets.find((t) => t.id === s.targetId);
    const connection = d.connections.find((c) => c.id === target?.connectionId);
    if (s.typeId !== SSH_KEY_TYPE || !target || connection?.protocol !== "ssh") {
      log.debug("terminal: not an SSH session", { secretId: id });
      return { secret, session: { kind: "not-ssh" } };
    }
    if (s.retired) return { secret, session: { kind: "retired" } };
    if (s.canRead !== true) return { secret, session: { kind: "locked" } };
    const f = await gw.gql(TargetsTerminalFieldsDocument, { id });
    const username = f.secretFields.find((x) => x.key === "username")?.value ?? "";
    log.debug("terminal ready", { pinned: target.sshHostKeys.length > 0, secretId: id });
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
  log.debug("ssh session open", { secretId: id });
  return guard(request, async () => {
    const started = Date.now();
    try {
      const { openSshSession } = await gw.gql(TargetsOpenSshSessionDocument, { secretId: id });
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
