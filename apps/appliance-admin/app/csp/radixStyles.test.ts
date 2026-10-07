import { dropRadixInlineStyles } from "@/csp/radixStyles";

const SELECT = "/x/node_modules/@radix-ui/react-select/dist/index.mjs";
const KNOWN = "[data-radix-select-viewport]{scrollbar-width:none;}";
const element = (css: string) =>
  `jsx(\n  "style",\n  {\n    dangerouslySetInnerHTML: {\n      __html: \`${css}\`\n    },\n    nonce\n  }\n)`;

describe("dropRadixInlineStyles", () => {
  it("replaces the inline <style> element with nothing when its CSS ships in radix.css", () => {
    const code = `return jsxs(Fragment, { children: [${element(KNOWN)}, jsx(Slot, {})] });`;
    expect(dropRadixInlineStyles(code, SELECT, `/* x */\n${KNOWN}\n`)).toBe(
      "return jsxs(Fragment, { children: [null, jsx(Slot, {})] });",
    );
  });

  it("matches radix.css however it's formatted", () => {
    const formatted = "[data-radix-select-viewport] {\n  scrollbar-width: none;\n}\n";
    expect(dropRadixInlineStyles(element(KNOWN), SELECT, formatted)).toBe("null");
  });

  it("fails the build when the CSS changed and radix.css no longer matches", () => {
    expect(() => dropRadixInlineStyles(element("[x]{}"), SELECT, KNOWN)).toThrow(/radix\.css/);
  });

  it("fails the build when a Radix module it watches has no inline style any more", () => {
    expect(() => dropRadixInlineStyles("export {};", SELECT, KNOWN)).toThrow(/react-select/);
  });

  it("leaves other modules alone", () => {
    expect(
      dropRadixInlineStyles(element(KNOWN), "/x/node_modules/other.mjs", KNOWN),
    ).toBeUndefined();
  });
});
