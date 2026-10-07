// react-remove-scroll (Radix dialogs, selects and menus) locks the page scroll with a <style>
// element from react-style-singleton, which osadmin's `default-src 'self'` blocks. The build
// swaps in this one (app/csp/styleSingletonPlugin.ts): the same add and remove counting, with
// a constructed stylesheet, which the CSP doesn't govern because nothing inline is parsed.

export const stylesheetSingleton = () => {
  let counter = 0;
  let sheet: CSSStyleSheet | null = null;
  return {
    add: (style: string) => {
      if (counter === 0) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(style);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }
      counter++;
    },
    remove: () => {
      counter--;
      if (counter === 0 && sheet) {
        const done = sheet;
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== done);
        sheet = null;
      }
    },
  };
};
