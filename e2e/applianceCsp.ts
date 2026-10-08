// Shared by e2e/applianceAdminServer.mjs and e2e/appliance-csp.spec.ts. The header is
// SecurityHeaders' in sneakers-appliance internal/osadmin/server.go; keep the two in step.
export const OSADMIN_CSP =
  "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
/** The tries left the CSP test server's refused sign-in reports. */
export const SIGN_IN_TRIES_LEFT = 2;
