// The appliance admin runs under sneakers-osadmin's `Content-Security-Policy: default-src
// 'self'`, so the built pages can't carry an inline script or style. React Router's SPA
// prerender writes its bootstrap and hydration data as inline scripts; the build moves each one
// to its own file (react-router.config.ts), and `npm run check:csp` refuses anything inline
// that is left. Build-time only: nothing here ships to the browser.
import { createHash } from "node:crypto";

export interface ExternalizedScript {
  content: string;
  /** The path under the client build folder. */
  fileName: string;
}

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const HAS_SRC = /\ssrc\s*=/i;

/**
 * Moves every inline `<script>` to `assets/inline-<sha256>.js` and points the tag at it, keeping
 * its other attributes (`type="module"`, `async`), so the scripts run in the same order.
 */
export const externalizeInlineScripts = (
  html: string,
  base: string,
): { files: ExternalizedScript[]; html: string } => {
  const files = new Map<string, ExternalizedScript>();
  const out = html.replaceAll(SCRIPT, (tag, attributes: string, content: string) => {
    if (HAS_SRC.test(attributes)) return tag;
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const fileName = `assets/inline-${digest}.js`;
    files.set(fileName, { content, fileName });
    return `<script${attributes} src="${base}${fileName}"></script>`;
  });
  return { files: [...files.values()], html: out };
};

const CHECKS: [RegExp, string][] = [
  [/<script\b(?![^>]*\ssrc\s*=)[^>]*>/gi, "an inline script"],
  [/<style\b[^>]*>/gi, "a style element"],
  [/<[a-z][^>]*\sstyle\s*=[^>]*>/gi, "a style attribute"],
  [/<[a-z][^>]*\son[a-z]+\s*=[^>]*>/gi, "an event handler attribute"],
  [/<[a-z][^>]*=\s*["']?\s*javascript:[^>]*>/gi, "a javascript: URL"],
  [
    /<(?:script|link)\b[^>]*\s(?:src|href)\s*=\s*["']?(?:[a-z][a-z0-9+.-]*:|\/\/)[^>]*>/gi,
    "a resource from another origin",
  ],
];

/** Everything in an HTML page that `default-src 'self'` would block, one line each. */
export const findCspViolations = (html: string): string[] =>
  CHECKS.flatMap(([pattern, what]) =>
    [...html.matchAll(pattern)].map((m) => `${what}: ${m[0].slice(0, 120)}`),
  );
