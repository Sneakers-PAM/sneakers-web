import { resolveStyleSingleton } from "@/csp/styleSingletonPlugin";

const INDEX = "/x/node_modules/react-style-singleton/dist/es2015/index.js";

describe("resolveStyleSingleton", () => {
  it.each(["index.js", "hook.js"])(
    "points react-style-singleton's own singleton at the constructed-sheet one from %s",
    (file) => {
      expect(resolveStyleSingleton("./singleton", INDEX.replace("index.js", file))).toMatch(
        /app[/\\]csp[/\\]styleSingleton\.ts$/,
      );
    },
  );

  it("leaves every other import alone", () => {
    expect(resolveStyleSingleton("./singleton", "/x/node_modules/other/index.js")).toBeUndefined();
    expect(resolveStyleSingleton("./component", INDEX)).toBeUndefined();
    expect(resolveStyleSingleton("./singleton")).toBeUndefined();
  });
});
