// sonner (the toasts in packages/ui) inserts its stylesheet as a runtime <style> element, which
// osadmin's `default-src 'self'` blocks. The appliance admin's build drops that insert and
// app.css imports sonner's own styles.css instead, so the same rules ship as a file.
import type { Plugin } from "vite";

const SONNER_ENTRY = /[/\\]node_modules[/\\]sonner[/\\]dist[/\\]index\.mjs$/;
const INSERT = /^__insertCSS\("(?:[^"\\]|\\.)*"\);?$/m;

/** The module without its CSS insert; undefined for any module that isn't sonner's. */
export const dropSonnerStyleInjection = (code: string, id: string): string | undefined => {
  if (!SONNER_ENTRY.test(id)) return undefined;
  if (!INSERT.test(code)) {
    throw new Error(
      "sonner no longer inserts its CSS with one __insertCSS call; check that it adds no <style> at run time and update app/csp/sonnerStyles.ts",
    );
  }
  return code.replace(INSERT, "");
};

export const sonnerStylesFromFile = (): Plugin => ({
  enforce: "pre",
  name: "appliance-admin:sonner-styles-from-file",
  transform: (code, id) => dropSonnerStyleInjection(code, id),
});
