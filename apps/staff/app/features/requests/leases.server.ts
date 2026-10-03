import {
  CheckoutsActiveLeaseDocument,
  CheckoutsCheckinDocument,
  CheckoutsCheckoutDocument,
  type CheckoutsLeaseFieldsFragment,
  createLogger,
  type GatewayClient,
} from "@sneakers-web/api-client";

import { act, type ActResult } from "@/features/requests/act.server";

const log = createLogger("checkouts");

/** The longest check-out the screens offer. */
export const MAX_CHECKOUT_HOURS = 24;

const hoursFrom = (raw: string): number | undefined => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_CHECKOUT_HOURS) : undefined;
};

/** The secret's active lease, whoever holds it, or null. */
export const activeLeaseFor = async (
  gw: GatewayClient,
  secretId: string,
): Promise<CheckoutsLeaseFieldsFragment | null> => {
  const { activeLease } = await gw.gql(CheckoutsActiveLeaseDocument, { secretId });
  log.debug("active lease read", { held: !!activeLease, secretId });
  return activeLease;
};

/**
 * Check a secret out for the signed-in user. `hours` is optional (the workflow then uses its
 * default) and capped at MAX_CHECKOUT_HOURS. A refusal (no check-out for the type, held by
 * someone, a step-up needed) comes back as data with its reason.
 */
export const checkOut = (request: Request, secretId: string, hours?: string): Promise<ActResult> =>
  act(request, "checkout", async (gw) => {
    const r = await gw.gql(CheckoutsCheckoutDocument, {
      hours: hours === undefined ? undefined : hoursFrom(hours),
      secretId,
    });
    log.info("checked out", { leaseId: r.checkoutSecret.id, secretId });
    return r.checkoutSecret.expiresAt;
  });

/** Check a secret back in for the signed-in user; it rotates on check-in. */
export const checkIn = (request: Request, secretId: string): Promise<ActResult> =>
  act(request, "checkin", async (gw) => {
    await gw.gql(CheckoutsCheckinDocument, { secretId });
    log.info("checked in", { secretId });
    return secretId;
  });
