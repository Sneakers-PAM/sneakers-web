import type { Plugin } from "vite";

// Swaps react-style-singleton's <style>-element singleton for app/csp/styleSingleton.ts in the
// appliance admin's build, so Radix's scroll lock works under osadmin's CSP. If a new
// react-style-singleton's modules stop importing './singleton', the build fails rather than shipping
// the <style> version.
import path from "node:path";

const PACKAGE = /[/\\]node_modules[/\\]react-style-singleton[/\\]dist[/\\]es2015[/\\][^/\\]+\.js$/;
const REPLACEMENT = path.join(import.meta.dirname, "styleSingleton.ts");

export const resolveStyleSingleton = (source: string, importer?: string): string | undefined =>
  source === "./singleton" && importer && PACKAGE.test(importer) ? REPLACEMENT : undefined;

export const cspSafeStyleSingleton = (): Plugin => {
  let swapped = false;
  return {
    // Vite hands a hook its plugin context as `this`.
    /* eslint-disable unicorn/no-this-outside-of-class */
    buildEnd(error) {
      if (!error && this.environment.name === "client" && !swapped) {
        this.error(
          "react-style-singleton no longer imports './singleton'; update app/csp/styleSingletonPlugin.ts so its <style> element can't ship",
        );
      }
    },
    /* eslint-enable unicorn/no-this-outside-of-class */
    enforce: "pre",
    name: "appliance-admin:csp-safe-style-singleton",
    resolveId(source, importer) {
      const replacement = resolveStyleSingleton(source, importer);
      if (replacement) swapped = true;
      return replacement;
    },
  };
};
