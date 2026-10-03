import type { GatewayClient } from "#api/gateway";

import { ApiError } from "#api/errors";

/** Whether the install still needs its first administrator. */
export const fetchSetupState = async (gw: GatewayClient): Promise<{ needsSetup: boolean }> => {
  const r = await gw.request<{ needsSetup?: boolean }>("/setup/state");
  return { needsSetup: !!r.needsSetup };
};

/** Why first-run setup refused a step, in words a page can match on. */
export type SetupProblem = "bad-token" | "done" | "missing" | "not-enabled" | "unavailable";

const problemOf = (error: unknown): SetupProblem => {
  if (!(error instanceof ApiError)) throw error;
  if (error.status === 403) return "bad-token";
  if (error.status === 409) return "done";
  if (error.status === 400) return "missing";
  if (error.status === 503 && /SETUP_TOKEN/.test(error.code ?? "")) return "not-enabled";
  return "unavailable";
};

export interface FirstAdmin {
  email: string;
  name: string;
  password: string;
  username: string;
}

/** Create the first admin (the protected root). The setup token is checked by the gateway. */
export const bootstrapAdmin = async (
  gw: GatewayClient,
  setupToken: string,
  admin: FirstAdmin,
): Promise<{ ok: false; problem: SetupProblem } | { ok: true; userId: string }> => {
  try {
    const r = await gw.request<{ userId?: string }>("/setup/bootstrap", {
      body: { ...admin, setupToken },
    });
    return { ok: true, userId: r.userId ?? "" };
  } catch (error) {
    return { ok: false, problem: problemOf(error) };
  }
};

/** Install the built-in types and baseline, acting as the new admin. Safe to retry. */
export const seedBuiltins = async (
  gw: GatewayClient,
  setupToken: string,
  userId: string,
): Promise<
  | { connections: number; folders: number; ok: true; types: number }
  | { ok: false; problem: SetupProblem }
> => {
  try {
    const r = await gw.request<{ connections?: number; folders?: number; types?: number }>(
      "/setup/seed",
      {
        body: { setupToken, userId },
      },
    );
    return {
      connections: r.connections ?? 0,
      folders: r.folders ?? 0,
      ok: true,
      types: r.types ?? 0,
    };
  } catch (error) {
    return { ok: false, problem: problemOf(error) };
  }
};

/** Email a verification code to an account that isn't signed in yet. */
export const requestEmailCode = async (gw: GatewayClient, userId: string): Promise<void> => {
  await gw.request("/auth/verify/request", { body: { userId } });
};

/** Check an emailed verification code. False means it was wrong or has expired. */
export const confirmEmailCode = async (
  gw: GatewayClient,
  userId: string,
  code: string,
): Promise<boolean> => {
  try {
    await gw.request("/auth/verify/confirm", { body: { code, userId } });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") return false;
    throw error;
  }
};
