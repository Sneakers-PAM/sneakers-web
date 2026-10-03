import { HttpResponse } from "msw";

import { userById } from "#mock/fixtures/users";

/**
 * A GraphQL refusal shaped the way the gateway sends one: the canonical code, the stable reason
 * and its metadata. Typed `never` so a typed resolver can return it in place of its data.
 */
export const refusal = (
  code: string,
  desc: string,
  reason?: string,
  metadata?: Record<string, string>,
): never =>
  HttpResponse.json({
    errors: [
      {
        extensions: { code, ...(reason ? { reason } : {}), ...(metadata ? { metadata } : {}) },
        message: `rpc error: code = ${code
          .toLowerCase()
          .replaceAll(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase())} desc = ${desc}`,
      },
    ],
  }) as never;

/** Root, or a site-admin role: what the gateway checks before an admin call. */
export const isSiteAdmin = (userId: string): boolean => {
  const u = userById(userId);
  return (
    !!u && !u.disabled && (u.isRoot || u.roles.includes("site-admin") || u.roles.includes("admin"))
  );
};

export const notSiteAdmin = () =>
  refusal("PERMISSION_DENIED", "site admin required", "NOT_SITE_ADMIN");
