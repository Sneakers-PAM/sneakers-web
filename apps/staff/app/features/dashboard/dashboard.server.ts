import type { HeartbeatStatus } from "@sneakers-web/ui";

import {
  ApiError,
  createLogger,
  DashboardHomeDocument,
  DashboardSecretNameDocument,
  DashboardSecretsByStatusDocument,
  type GatewayClient,
} from "@sneakers-web/api-client";
import { refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser, type SessionUser } from "@sneakers-web/shell/server";

import { folderPaths } from "@/features/dashboard/folderPath";
import { asStatus, type SecretStatus } from "@/features/dashboard/status";

const log = createLogger("staff.dashboard");

const TOP_LIMIT = 5;
const EXPIRING_WINDOW_MS = 30 * 86_400_000;
/** Codes where the same call may well work a moment later, so the page offers Retry. */
const TRANSIENT = new Set(["DEADLINE_EXCEEDED", "INTERNAL", "UNAVAILABLE", "UNKNOWN"]);

/** Why a page's data didn't load, in a form the page can show. */
export interface LoadFailure {
  code?: string;
  message: string;
  reason?: string;
  retry: boolean;
}

type Loaded<T> = { failure: LoadFailure; ok: false } | ({ ok: true } & T);

/**
 * Run a page's gateway work as the signed-in user. A refusal or a failing gateway comes back
 * as data for the page's error state; session trouble still redirects.
 */
const load = async <T>(
  request: Request,
  what: string,
  work: (gw: GatewayClient, user: SessionUser) => Promise<T>,
): Promise<Loaded<T>> => {
  const { gw, user } = await requireUser(request);
  const started = Date.now();
  log.debug(`${what}: loading`, { userId: user.id });
  return guard(request, async () => {
    try {
      const value = await work(gw, user);
      log.debug(`${what}: loaded`, { ms: Date.now() - started, userId: user.id });
      return { ok: true as const, ...value };
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal) {
        log.warn(`${what}: refused`, {
          code: refusal.code,
          reason: refusal.reason,
          userId: user.id,
        });
        return {
          failure: {
            code: refusal.code,
            message: refusalMessage(refusal),
            reason: refusal.reason,
            retry: !refusal.code || TRANSIENT.has(refusal.code),
          },
          ok: false as const,
        };
      }
      if (error instanceof ApiError && error.status >= 500) {
        log.error(`${what}: gateway error`, { status: error.status, userId: user.id });
        return {
          failure: {
            code: error.code,
            message: "The server had a problem. Try again.",
            retry: true,
          },
          ok: false as const,
        };
      }
      throw error;
    }
  });
};

export interface AgentCard {
  clientLabel: string;
  /** The command the agent wants to run, or null when the value goes to the token itself. */
  command: null | string;
  expiresAt: number;
  fieldKey: string;
  id: string;
  secretName: string;
}

export interface CheckoutCard {
  expiresAt: string;
  id: string;
  secretId: string;
  secretName: string;
}

export interface RequestCard {
  folderName: string;
  id: string;
  kind: string;
  messages: number;
  requestedAt: string;
}

export interface TopSecret {
  folderPath: string;
  id: string;
  lastAccessedAt: null | string;
  name: string;
  viewCount: number;
}

/** U-01: the stat tiles, the quick cards (agents waiting, checkouts, my requests) and the top five. */
export const loadDashboard = (request: Request) =>
  load(request, "dashboard", async (gw, user) => {
    const d = await gw.gql(DashboardHomeDocument, { limit: TOP_LIMIT, userId: user.id });
    const path = folderPaths(d.folders);
    const checkouts = await Promise.all(
      d.activeLeasesForUser.map(async (l): Promise<CheckoutCard> => {
        const named = await gw.gql(DashboardSecretNameDocument, { id: l.secretId });
        if (!named.secret) log.debug("checkout secret not readable", { leaseId: l.id });
        return {
          expiresAt: l.expiresAt,
          id: l.id,
          secretId: l.secretId,
          secretName: named.secret?.name ?? "A secret",
        };
      }),
    );
    const requests = d.approvalRequests
      .filter((r) => r.requestedByUserId === user.id && r.status === "pending")
      .map((r) => ({
        folderName: r.folderName,
        id: r.id,
        kind: r.kind,
        messages: r.comments.length,
        requestedAt: r.requestedAt,
      }));
    log.trace("dashboard counts", {
      agents: d.pendingSecretUses.length,
      checkouts: checkouts.length,
      requests: requests.length,
      total: d.secretStats.total,
    });
    return {
      agents: d.pendingSecretUses.map((u): AgentCard => ({
        clientLabel: u.clientLabel,
        command: u.reveal || u.argv.length === 0 ? null : u.argv.join(" "),
        expiresAt: u.expiresAtUnix * 1000,
        fieldKey: u.fieldKey,
        id: u.id,
        secretName: u.secretName,
      })),
      checkouts,
      loadedAt: Date.now(),
      requests,
      stats: d.secretStats,
      top: d.topAccessedSecrets.map((s): TopSecret => ({
        folderPath: path(s.folderId),
        id: s.id,
        lastAccessedAt: s.lastAccessedAt,
        name: s.name,
        viewCount: s.viewCount ?? 0,
      })),
    };
  });

export type Expiry = "later" | "past" | "soon";

export interface StatusRow {
  expiresAt: null | string;
  expiry: Expiry | null;
  folderPath: string;
  heartbeat: HeartbeatStatus;
  id: string;
  name: string;
  typeName: string;
}

const heartbeatOf = (s: { lastHeartbeatResult: null | string; targetId: null | string }) => {
  if (s.lastHeartbeatResult === "ok") return "verified";
  if (s.lastHeartbeatResult === "failed") return "drift";
  if (s.lastHeartbeatResult === "unreachable") return "unreachable";
  return s.targetId ? "unknown" : "none";
};

const expiryOf = (expiresAt: null | string, now: number): Expiry | null => {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  if (t < now) return "past";
  return t <= now + EXPIRING_WINDOW_MS ? "soon" : "later";
};

/** U-02: the readable secrets behind one stat tile (`?status=`), sorted by name. */
export const loadSecretsByStatus = async (request: Request) => {
  const status: SecretStatus = asStatus(new URL(request.url).searchParams.get("status"));
  const loaded = await load(request, "secrets by status", async (gw) => {
    const d = await gw.gql(DashboardSecretsByStatusDocument, { status });
    const path = folderPaths(d.folders);
    const types = new Map(d.secretTypes.map((t) => [t.id, t.name]));
    const now = Date.now();
    log.trace("secrets by status", { count: d.secretsByStatus.length, status });
    return {
      rows: d.secretsByStatus
        .map((s): StatusRow => ({
          expiresAt: s.expiresAt,
          expiry: expiryOf(s.expiresAt, now),
          folderPath: path(s.folderId),
          heartbeat: heartbeatOf(s),
          id: s.id,
          name: s.name,
          typeName: types.get(s.typeId) ?? s.typeId,
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    };
  });
  return { ...loaded, status };
};
