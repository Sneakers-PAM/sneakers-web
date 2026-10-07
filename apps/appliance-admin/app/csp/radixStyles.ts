import type { Plugin } from "vite";

// Radix's select (and scroll area) viewport renders an inline <style> to hide its scrollbar,
// which osadmin's `default-src 'self'` blocks. The appliance admin's build replaces that element
// with nothing and app/csp/radix.css ships the same rules as a file. The build fails if the
// rules change and radix.css no longer has them, or the element goes away.
import { readFileSync } from "node:fs";
import path from "node:path";

const MODULE =
  /[/\\]node_modules[/\\]@radix-ui[/\\](react-select|react-scroll-area)[/\\]dist[/\\]index\.mjs$/;
const STYLE_ELEMENT =
  /jsx\(\s*"style",\s*\{\s*dangerouslySetInnerHTML:\s*\{\s*__html:\s*`([^`]*)`\s*\},\s*nonce\s*\}\s*\)/g;
const SHIPPED = path.join(import.meta.dirname, "radix.css");

/** Whitespace and a rule's last semicolon don't count, so radix.css can stay formatted. */
const normalize = (css: string) => css.replaceAll(/\s+/g, "").replaceAll(";}", "}");

/** The module without its inline style elements; undefined for any module it doesn't watch. */
export const dropRadixInlineStyles = (
  code: string,
  id: string,
  shipped: string,
): string | undefined => {
  const name = MODULE.exec(id)?.[1];
  if (!name) return undefined;
  const rules = normalize(shipped);
  let found = 0;
  const out = code.replaceAll(STYLE_ELEMENT, (_element, css: string) => {
    if (!rules.includes(normalize(css))) {
      throw new Error(
        `@radix-ui/${name} changed its inline CSS; copy it into app/csp/radix.css: ${css}`,
      );
    }
    found++;
    return "null";
  });
  if (found === 0) {
    throw new Error(
      `@radix-ui/${name} no longer renders an inline <style> this build recognises; check it adds none and update app/csp/radixStyles.ts`,
    );
  }
  return out;
};

export const radixStylesFromFile = (): Plugin => ({
  enforce: "pre",
  name: "appliance-admin:radix-styles-from-file",
  transform: (code, id) => dropRadixInlineStyles(code, id, readFileSync(SHIPPED, "utf8")),
});
