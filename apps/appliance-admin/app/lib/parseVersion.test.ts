import { describe, expect, it } from "vitest";

import { parseVersion, shortName } from "@/lib/parseVersion";

describe("parseVersion", () => {
  it("reads a dated lab build with a rebuild number", () => {
    expect(parseVersion("0.0.0-lab.20261009m2.r20261010031325-g79c3ceb")).toEqual({
      build: "m2",
      builtAt: "2026-10-10T03:13:25Z",
      channel: "lab",
      commit: "79c3ceb",
      line: "0.0.0-lab",
      raw: "0.0.0-lab.20261009m2.r20261010031325-g79c3ceb",
    });
  });

  it("reads a dated lab build with no rebuild number and no built-at stamp", () => {
    expect(parseVersion("0.0.0-lab.20261009k-g448530b")).toEqual({
      build: "k",
      builtAt: undefined,
      channel: "lab",
      commit: "448530b",
      line: "0.0.0-lab",
      raw: "0.0.0-lab.20261009k-g448530b",
    });
  });

  it("reads a release candidate", () => {
    expect(parseVersion("0.1.0-rc.1")).toEqual({
      build: "rc1",
      builtAt: undefined,
      channel: "rc",
      commit: undefined,
      line: "0.1.0",
      raw: "0.1.0-rc.1",
    });
  });

  it("reads a stable release as just its line, with no build of its own", () => {
    expect(parseVersion("0.1.0")).toEqual({
      build: undefined,
      builtAt: undefined,
      channel: "stable",
      commit: undefined,
      line: "0.1.0",
      raw: "0.1.0",
    });
  });

  it("reads the product's own lab scheme, which names a build with no date stamp", () => {
    expect(parseVersion("0.1.0-lab.sneakers.6")).toEqual({
      build: "sneakers.6",
      builtAt: undefined,
      channel: "lab",
      commit: undefined,
      line: "0.1.0-lab",
      raw: "0.1.0-lab.sneakers.6",
    });
  });

  it("returns null for a string with no semver core, such as a file name", () => {
    expect(
      parseVersion(
        "sneakers-appliance-baseOS-patch-0.0.0-lab.20261009m1.r20261009215558-g79c3ceb-from-0.0.0-lab.20261009m.r20261009215048-g79c3ceb-amd64-LAB.bin",
      ),
    ).toBeNull();
  });
});

describe("shortName", () => {
  it("is the build's own label for a lab build", () => {
    expect(shortName("0.0.0-lab.20261009m2.r20261010031325-g79c3ceb")).toBe("m2");
    expect(shortName("0.0.0-lab.20261009m.r20261009215048-g79c3ceb")).toBe("m");
  });

  it("is the release line for a stable release, which has no build beyond it", () => {
    expect(shortName("0.1.0")).toBe("0.1.0");
  });

  it("is rc<N> for a release candidate", () => {
    expect(shortName("0.1.0-rc.1")).toBe("rc1");
  });

  it("falls back to the raw string when it doesn't parse as a version", () => {
    expect(shortName("built-in")).toBe("built-in");
  });
});

describe("a dated lab build with a rebuild number", () => {
  it("reads 0.0.0-lab.20261010n4.r20261010141538-g6f08507 apart", () => {
    const parsed = parseVersion("0.0.0-lab.20261010n4.r20261010141538-g6f08507");
    expect(parsed).toMatchObject({
      build: "n4",
      builtAt: "2026-10-10T14:15:38Z",
      channel: "lab",
      commit: "6f08507",
      line: "0.0.0-lab",
    });
    expect(shortName("0.0.0-lab.20261010n4.r20261010141538-g6f08507")).toBe("n4");
  });
});
