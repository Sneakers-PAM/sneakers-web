import { dropSonnerStyleInjection } from "@/csp/sonnerStyles";

const SONNER = "/x/node_modules/sonner/dist/index.mjs";

describe("dropSonnerStyleInjection", () => {
  it("removes sonner's runtime <style> insert and nothing else", () => {
    const code =
      'function __insertCSS(code) {}\n__insertCSS("[data-x]{content:\\"a\\"}");\nexport { toast };\n';
    expect(dropSonnerStyleInjection(code, SONNER)).toBe(
      "function __insertCSS(code) {}\n\nexport { toast };\n",
    );
  });

  it("fails the build when a new sonner injects its styles some other way", () => {
    expect(() => dropSonnerStyleInjection("export { toast };", SONNER)).toThrow(/sonner/);
  });

  it("leaves other modules alone", () => {
    const code = '__insertCSS("x");';
    expect(dropSonnerStyleInjection(code, "/x/node_modules/other/index.mjs")).toBeUndefined();
  });
});
