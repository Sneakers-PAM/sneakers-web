import { CheckoutsMineDocument, createLogger } from "@sneakers-web/api-client";
import { guard, requireUser } from "@sneakers-web/shell/server";

import { type ActResult, field } from "@/features/requests/act.server";
import { checkIn, checkOut } from "@/features/requests/leases.server";
import { secretsById } from "@/features/requests/secrets.server";

const log = createLogger("checkouts");

export interface CheckoutRow {
  expiresAt: string;
  issuedAt: string;
  leaseId: string;
  name: string;
  secretId: string;
}

/** U-08: the secrets the signed-in user holds right now, soonest to expire first. */
export const loadCheckouts = async (request: Request): Promise<{ checkouts: CheckoutRow[] }> => {
  const { gw, user } = await requireUser(request);
  log.debug("checkouts load");
  return guard(request, async () => {
    const { activeLeasesForUser } = await gw.gql(CheckoutsMineDocument, { userId: user.id });
    const secrets = await secretsById(
      gw,
      activeLeasesForUser.map((l) => l.secretId),
    );
    const checkouts = activeLeasesForUser
      .map((l) => ({
        expiresAt: l.expiresAt,
        issuedAt: l.issuedAt,
        leaseId: l.id,
        name: secrets.get(l.secretId)?.name ?? "A secret you can't see",
        secretId: l.secretId,
      }))
      .toSorted((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
    log.debug("checkouts loaded", { count: checkouts.length });
    return { checkouts };
  });
};

/**
 * The /checkouts form intents, `checkin` and `checkout`, each naming `secretId` (and `hours`
 * for a check-out). Other pages can post here with a fetcher.
 */
export const checkoutsAction = async (request: Request): Promise<ActResult> => {
  const form = await request.formData();
  const intent = field(form, "intent");
  const secretId = field(form, "secretId");
  if (intent === "checkin") return checkIn(request, secretId);
  if (intent === "checkout") return checkOut(request, secretId, field(form, "hours") || undefined);
  log.warn("unknown intent", { intent });
  throw new Response("Unknown intent", { status: 400 });
};
