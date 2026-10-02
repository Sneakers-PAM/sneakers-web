// @vitest-environment node
import type { RouteConfigEntry } from "@react-router/dev/routes";

import { existsSync } from "node:fs";
import path from "node:path";

import routes from "@/routes";

const flatten = (entries: RouteConfigEntry[], prefix = ""): { file: string; path: string }[] =>
  entries.flatMap((entry) => {
    const here = entry.index
      ? prefix || "/"
      : entry.path
        ? `${prefix}/${entry.path}`.replace("//", "/")
        : prefix;
    return [
      ...(entry.path || entry.index ? [{ file: entry.file, path: here }] : []),
      ...flatten(entry.children ?? [], here),
    ];
  });

const table = flatten(routes);
const paths = table.map((r) => r.path);

describe("the staff route table", () => {
  it("serves every page the staff app has", () => {
    for (const p of [
      "/",
      "/secrets",
      "/browse",
      "/browse/:folderId",
      "/secret/new",
      "/secret/:id",
      "/secret/:id/edit",
      "/secret/:id/sharing",
      "/folder/:id/sharing",
      "/secret/:id/terminal",
      "/checkouts",
      "/requests",
      "/targets",
      "/targets/new",
      "/targets/:id",
      "/tokens",
      "/approvals",
      "/grants",
      "/security",
      "/oauth/consent",
    ]) {
      expect(paths).toContain(p);
    }
  });

  it("points every page at a module that exists", () => {
    for (const r of table)
      expect(existsSync(path.join(import.meta.dirname, r.file)), r.file).toBe(true);
  });

  it("gives each staff page its own module, so slices never edit the same file", () => {
    const pages = table.filter(
      (r) => !/^\/(sign-in|enroll|sign-out|resources|healthz)|^\*$|\/\*$/.test(r.path),
    );
    const files = [...new Set(pages.map((r) => r.file))];
    const shared = files
      .map((file) => [file, pages.filter((r) => r.file === file).map((r) => r.path)] as const)
      .filter(([, served]) => served.length > 1);
    expect(shared).toEqual([
      ["routes/browse.tsx", ["/browse", "/browse/:folderId"]],
      ["routes/sharing.tsx", ["/folder/:id/sharing", "/secret/:id/sharing"]],
      ["routes/target.tsx", ["/targets/new", "/targets/:id"]],
    ]);
  });
});
