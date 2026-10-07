import { createHash } from "node:crypto";

import { externalizeInlineScripts, findCspViolations } from "@/csp/inline";

const sha = (content: string) => createHash("sha256").update(content).digest("hex").slice(0, 16);

describe("externalizeInlineScripts", () => {
  it("moves each inline script to a file named by its content, in place and in order", () => {
    const html =
      '<html><body><script>window.a = 1;</script><script type="module" async="">import "/assets/x.js";</script>' +
      '<script src="/assets/kept.js"></script></body></html>';
    const { files, html: out } = externalizeInlineScripts(html, "/");

    expect(files).toEqual([
      { content: "window.a = 1;", fileName: `assets/inline-${sha("window.a = 1;")}.js` },
      {
        content: 'import "/assets/x.js";',
        fileName: `assets/inline-${sha('import "/assets/x.js";')}.js`,
      },
    ]);
    expect(out).toBe(
      `<html><body><script src="/assets/inline-${sha("window.a = 1;")}.js"></script>` +
        `<script type="module" src="/assets/inline-${sha('import "/assets/x.js";')}.js"></script>` +
        '<script src="/assets/kept.js"></script></body></html>',
    );
    expect(findCspViolations(out)).toEqual([]);
  });

  it("drops async, so React doesn't take the module script for a hoisted resource", () => {
    const { html } = externalizeInlineScripts('<script type="module" async>m()</script>', "/");
    expect(html).toBe(`<script type="module" src="/assets/inline-${sha("m()")}.js"></script>`);
  });

  it("writes one file for scripts with the same content and honours the base path", () => {
    const { files, html } = externalizeInlineScripts(
      "<script>x()</script><script>x()</script>",
      "/ui/",
    );
    expect(files).toHaveLength(1);
    expect(html).toBe(`<script src="/ui/assets/inline-${sha("x()")}.js"></script>`.repeat(2));
  });

  it("leaves a page without inline scripts as it is", () => {
    const html = '<script src="/a.js"></script>';
    expect(externalizeInlineScripts(html, "/")).toEqual({ files: [], html });
  });
});

describe("findCspViolations", () => {
  it.each([
    ["an inline script", "<script>alert(1)</script>"],
    ["an empty inline script", "<script></script>"],
    ["a style element", "<style>body{}</style>"],
    ["a style attribute", '<html style="--text-scale:1">'],
    ["an event handler attribute", '<img onerror="x()" src="/a.svg">'],
    ["a javascript: URL", '<a href="javascript:x()">x</a>'],
    ["a script from another origin", '<script src="https://cdn.example.org/a.js"></script>'],
    ["a protocol-relative stylesheet", '<link rel="stylesheet" href="//cdn.example.org/a.css">'],
  ])("refuses %s", (_name, html) => {
    expect(findCspViolations(html)).toHaveLength(1);
  });

  it("allows same-origin scripts, stylesheets and plain markup", () => {
    expect(
      findCspViolations(
        '<!DOCTYPE html><html class="system" lang="en"><head><link href="/assets/app.css" rel="stylesheet"/>' +
          '<script type="module" async="" src="/assets/a.js"></script></head><body data-styled="x"></body></html>',
      ),
    ).toEqual([]);
  });
});
