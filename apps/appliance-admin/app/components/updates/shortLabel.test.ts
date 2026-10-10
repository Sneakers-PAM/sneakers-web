import { describe, expect, it } from "vitest";

import {
  buildId,
  shortLabel,
  shortVersion,
  withShortVersion,
} from "@/components/updates/shortLabel";

const LAB_CURRENT = "0.0.0-lab.20261009m1.r20261009215558-g79c3ceb";
const LAB_PREVIOUS = "0.0.0-lab.20261009m.r20261009215048-g79c3ceb";
const LAB_PATCH_FILE =
  "sneakers-appliance-baseOS-patch-0.0.0-lab.20261009m1.r20261009215558-g79c3ceb-from-0.0.0-lab.20261009m.r20261009215048-g79c3ceb-amd64-LAB.bin";

describe("shortVersion", () => {
  it("leaves a short release version unchanged", () => {
    expect(shortVersion("0.2.0")).toBe("0.2.0");
  });

  it("shortens a long lab build to its semver head and commit tail", () => {
    expect(shortVersion(LAB_CURRENT)).toBe("0.0.0-lab…g79c3ceb");
  });

  it("declines to shorten a string with no clean semver head, the longest real file name", () => {
    expect(shortVersion(LAB_PATCH_FILE)).toBe(LAB_PATCH_FILE);
  });
});

describe("buildId", () => {
  it("finds the build letter and number in a lab version", () => {
    expect(buildId(LAB_CURRENT)).toBe("m1");
    expect(buildId(LAB_PREVIOUS)).toBe("m");
  });

  it("is empty for a version with no embedded build id", () => {
    expect(buildId("0.2.0")).toBe("");
  });

  it("finds the first build id in a longer name", () => {
    expect(buildId(LAB_PATCH_FILE)).toBe("m1");
  });
});

describe("shortLabel", () => {
  it("is the plain version when it's already short", () => {
    expect(shortLabel("0.2.0")).toBe("0.2.0");
  });

  it("is the build id and the shortened version for the longest real lab build", () => {
    expect(shortLabel(LAB_CURRENT)).toBe("m1 · 0.0.0-lab…g79c3ceb");
  });

  it("is the build id and the shortened previous build", () => {
    expect(shortLabel(LAB_PREVIOUS)).toBe("m · 0.0.0-lab…g79c3ceb");
  });

  it("never throws on the longest real file name, the lab patch bundle", () => {
    expect(() => shortLabel(LAB_PATCH_FILE)).not.toThrow();
    expect(shortLabel(LAB_PATCH_FILE)).toBe(`m1 · ${LAB_PATCH_FILE}`);
  });
});

describe("withShortVersion", () => {
  it("swaps the version inside a sentence for its short label", () => {
    expect(withShortVersion(`Apply ${LAB_CURRENT}`, LAB_CURRENT)).toBe(
      "Apply m1 · 0.0.0-lab…g79c3ceb",
    );
  });

  it("leaves text unchanged when the version isn't in it", () => {
    expect(withShortVersion("Apply 0.2.0", "")).toBe("Apply 0.2.0");
  });
});
