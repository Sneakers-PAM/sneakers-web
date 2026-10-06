import {
  BreakGlassBrowseDocument,
  type BreakGlassBrowseQuery,
  BreakGlassCurrentDocument,
  BreakGlassOpenDocument,
  BreakGlassOwnersDocument,
  createLogger,
  GraphQLRequestError,
  SecretBreakGlassDocument,
} from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";
import { data } from "react-router";

const log = createLogger("break-glass");

export type BreakGlassActionResult =
  | {
      /** When the reveal was recorded (ms). */
      at: number;
      fields: { key: string; value: string }[];
      intent: "reveal";
      ok: true;
      secretId: string;
    }
  | { intent: "open"; ok: true }
  | { intent: string; ok: false; refusal: Refusal; secretId?: string };
export type BreakGlassFolder = BreakGlassBrowseQuery["breakGlassBrowse"]["folders"][number];

export type BreakGlassSecret = BreakGlassBrowseQuery["breakGlassBrowse"]["secrets"][number];

/** The break-glass page: the open session and everything it lists, or the form to open one. */
export interface BreakGlassView {
  folders: BreakGlassFolder[];
  /** Display names for the people whose personal folders are listed, by user id. */
  owners: Record<string, string>;
  secrets: BreakGlassSecret[];
  session: { expiresAt: string; id: string; openedAt: string; reason: string } | null;
  types: Record<string, string>;
}

const CLOSED: BreakGlassView = { folders: [], owners: {}, secrets: [], session: null, types: {} };

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

/** Break-glass is for site admins; anyone else gets the not-found page, as for a hidden route. */
const requireAdmin = async (request: Request) => {
  const signedIn = await requireUser(request);
  if (!isAdmin(signedIn.user)) throw data(null, { status: 404 });
  return signedIn;
};

const closed = (error: unknown) =>
  error instanceof GraphQLRequestError && error.reason === "BREAK_GLASS_SESSION_CLOSED";

export const loadBreakGlass = async (request: Request): Promise<BreakGlassView> => {
  const { gw, user } = await requireAdmin(request);
  return guard(request, async () => {
    const { breakGlassSession: session } = await gw.gql(BreakGlassCurrentDocument);
    if (!session) return CLOSED;
    try {
      const d = await gw.gql(BreakGlassBrowseDocument, { sessionId: session.id });
      const { folders, secrets } = d.breakGlassBrowse;
      const ownerIds = [
        ...new Set(
          folders.flatMap((f) => (f.scope === "personal" && f.ownerUserId ? [f.ownerUserId] : [])),
        ),
      ];
      const owners =
        ownerIds.length > 0
          ? await gw
              .gql(BreakGlassOwnersDocument, { ids: ownerIds })
              .then((o) => Object.fromEntries(o.resolveUserLabels.map((l) => [l.id, l.name])))
              .catch(() => ({}))
          : {};
      log.debug("break-glass view", {
        folders: folders.length,
        secrets: secrets.length,
        userId: user.id,
      });
      return {
        folders,
        owners,
        secrets,
        session,
        types: Object.fromEntries(d.secretTypes.map((t) => [t.id, t.name])),
      };
    } catch (error) {
      // Ended between the two calls (expired, or exited in another tab): the normal page.
      if (closed(error)) return CLOSED;
      throw error;
    }
  });
};

/** Open a session (intent `open`) or reveal a secret in it (intent `reveal`). */
export const breakGlassAction = async (request: Request): Promise<BreakGlassActionResult> => {
  const { gw, user } = await requireAdmin(request);
  const f = await request.formData();
  const intent = text(f, "intent");
  const secretId = text(f, "secretId") || undefined;
  log.info("break-glass action", { intent, secretId, userId: user.id });
  return guard(request, async () => {
    try {
      if (intent === "open") {
        await gw.gql(BreakGlassOpenDocument, { code: text(f, "code"), reason: text(f, "reason") });
        return { intent: "open", ok: true } as const;
      }
      if (intent === "reveal" && secretId) {
        const r = await gw.gql(SecretBreakGlassDocument, {
          code: text(f, "code"),
          reason: text(f, "reason"),
          secretId,
          sessionId: text(f, "sessionId"),
        });
        return {
          at: Date.now(),
          fields: r.breakGlassSecret,
          intent: "reveal",
          ok: true,
          secretId,
        } as const;
      }
      throw data(null, { status: 400 });
    } catch (error) {
      if (error instanceof Response) throw error;
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      log.warn("break-glass action refused", {
        code: refusal.code,
        intent,
        reason: refusal.reason,
      });
      return { intent, ok: false, refusal, secretId };
    }
  });
};
