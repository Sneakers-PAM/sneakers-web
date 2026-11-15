// @vitest-environment node
import routes from "@/routes";

// The gateway answers /.well-known/sneakers and /share/{token} itself, outside any sign-in. The
// edge sends them past this app, so the app must never claim them (Sneakers-PAM/sneakers-web#411).
type Route = { children?: Route[]; path?: string };

const paths = (list: Route[]): string[] =>
  list.flatMap((r) => [...(r.path ? [r.path] : []), ...paths(r.children ?? [])]);

describe("admin routes", () => {
  it("claims neither the gateway's discovery route nor its share links", () => {
    const all = paths(routes as Route[]);
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((p) => p === "share" || p.startsWith("share/"))).toEqual([]);
    expect(all.filter((p) => p.startsWith(".well-known"))).toEqual([]);
  });
});
