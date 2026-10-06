import type { Refusal } from "@sneakers-web/shell";

/** What an agents action answers: done (with the toast's text), or the refusal and its sentence. */
export type AgentsResult =
  | {
      /** The gateway's own factor or token check said no (it sends no code for those). */
      factorRejected: boolean;
      intent: string;
      message: string;
      ok: false;
      refusal: Refusal;
    }
  | {
      done: string;
      intent: string;
      ok: true;
      passkey?: { options: string; webauthnSessionId: string };
    };
export interface FolderChoice {
  id: string;
  path: string;
}

export interface GrantRow {
  endsAt: number;
  fields: string;
  id: string;
  programs: string[];
  reveal: boolean;
  scope: string;
  state: GrantState;
  token: string;
  uses: string;
}

export type GrantState = "active" | "expired" | "revoked" | "used";

/** A secret the grant form can pick, with the sensitive fields its type has. */
export interface SecretChoice {
  fields: string[];
  id: string;
  name: string;
  path: string;
}

export interface TokenChoice {
  app: string;
  id: string;
  label: string;
}

/** A personal token as My tokens shows it. Times are ms since the epoch; null means never. */
export interface TokenRow {
  app: string;
  createdAt: number;
  id: string;
  label: string;
  lastUsedAt: null | number;
  state: TokenState;
}

export type TokenState = "active" | "expired" | "revoked";

/** A pending secret use: someone else's to decide, or one of the user's own. */
export interface UseRow {
  clientLabel: string;
  /** The command the value goes to, or "" for a reveal to the agent itself. */
  command: string;
  /** Nobody else can decide it, so its requester confirms it once. */
  confirm: boolean;
  expiresAt: number;
  fieldKey: string;
  id: string;
  /** Who asked, by name. */
  requestedBy: string;
  reveal: boolean;
  /** The run it belongs to, whose page decides or confirms it with the rest of the task. */
  runId: null | string;
  secretName: string;
}

/** Fields a grant covers when it names none: the vault's default. */
export const DEFAULT_GRANT_FIELD = "password";
export const GRANT_MAX_HOURS = 24;

export const tokenState = (
  t: { expiresAtUnix: number; revokedAtUnix: number },
  nowS: number,
): TokenState => {
  if (t.revokedAtUnix) return "revoked";
  if (t.expiresAtUnix && t.expiresAtUnix <= nowS) return "expired";
  return "active";
};

export const grantState = (
  g: { expiresAtUnix: number; maxUses: number; revokedAtUnix: number; uses: number },
  nowS: number,
): GrantState => {
  if (g.revokedAtUnix) return "revoked";
  if (g.expiresAtUnix <= nowS) return "expired";
  if (g.maxUses && g.uses >= g.maxUses) return "used";
  return "active";
};

/** A grant's uses as "3 / 20", or "3 / no limit" when it has none. */
export const usesText = (uses: number, maxUses: number): string =>
  `${uses} / ${maxUses || "no limit"}`;

/** A program row as the grants table shows it: the program and its argument pattern. */
export const programText = (p: { argPattern: string; program: string }): string =>
  [p.program, p.argPattern].filter(Boolean).join(" ");

/** A folder's path from the top, "Platform / Databases". */
export const folderPath = (
  id: string,
  folders: Map<string, { name: string; parentId?: null | string }>,
): string => {
  const names: string[] = [];
  const seen = new Set<string>();
  let at: null | string | undefined = id;
  while (at && !seen.has(at)) {
    seen.add(at);
    const f = folders.get(at);
    if (!f) break;
    names.unshift(f.name);
    at = f.parentId;
  }
  return names.join(" / ");
};
