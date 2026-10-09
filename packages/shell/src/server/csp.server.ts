import { randomBytes } from "node:crypto";

/** A fresh nonce for one response's inline scripts (React Router's context and hydration). */
export const newNonce = (): string => randomBytes(16).toString("base64");

/**
 * The staff and admin apps' Content-Security-Policy. Scripts come from this origin or carry the
 * response's nonce: React Router's inline context and React's streaming scripts get it from the
 * render. Styles allow inline, for the runtime styles the UI kit's toasts and Radix insert. The
 * browser talks only to this origin (every gateway call runs on the app server). There is no
 * form-action, because the single sign-on form's redirect goes to the identity provider.
 */
export const contentSecurityPolicy = (nonce: string): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
