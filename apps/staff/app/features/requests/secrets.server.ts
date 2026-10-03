import { createLogger, type GatewayClient, RequestsSecretDocument } from "@sneakers-web/api-client";

const log = createLogger("requests");

export interface SecretInfo {
  approve: boolean;
  id: string;
  name: null | string;
  read: boolean;
}

/**
 * The name and the caller's access for each secret, one lookup per id. A secret the caller
 * can't see, or one that fails to load, comes back without a name rather than failing the page.
 */
export const secretsById = async (
  gw: GatewayClient,
  ids: string[],
): Promise<Map<string, SecretInfo>> => {
  const unique = [...new Set(ids.filter(Boolean))];
  const started = performance.now();
  const rows = await Promise.all(
    unique.map(async (id): Promise<SecretInfo> => {
      try {
        const d = await gw.gql(RequestsSecretDocument, { id, secretId: id });
        return {
          approve: d.mySecretAccess.approve,
          id,
          name: d.secret?.name ?? null,
          read: d.mySecretAccess.read,
        };
      } catch (error) {
        log.warn("secret lookup failed", { error: String(error), secretId: id });
        return { approve: false, id, name: null, read: false };
      }
    }),
  );
  log.debug("secrets looked up", {
    count: unique.length,
    ms: Math.round(performance.now() - started),
  });
  return new Map(rows.map((r) => [r.id, r]));
};
