import { describe, expect, it } from "vitest";

import { trustProxy } from "./app.mjs";

describe("TRUST_PROXY", () => {
  it("trusts nothing unless it is set, so forwarded headers are ignored by default", () => {
    expect(trustProxy()).toBe(false);
    expect(trustProxy("")).toBe(false);
    expect(trustProxy("false")).toBe(false);
  });

  it("takes true, a hop count, or proxy addresses and ranges", () => {
    expect(trustProxy("true")).toBe(true);
    expect(trustProxy("1")).toBe(1);
    expect(trustProxy("192.0.2.0/24, 198.51.100.7")).toEqual(["192.0.2.0/24", "198.51.100.7"]);
  });
});
