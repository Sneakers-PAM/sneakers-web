import { versionLabel } from "#shell/gate/versionLabel";

describe("versionLabel", () => {
  it("puts one v in front of a bare version", () => {
    expect(versionLabel("0.1.0")).toBe("v0.1.0");
  });

  it("doesn't double a v the version already has", () => {
    expect(versionLabel("v0.1.0-lab.sneakers.4")).toBe("v0.1.0-lab.sneakers.4");
    expect(versionLabel("V0.1.0")).toBe("v0.1.0");
    expect(versionLabel(" v 0.1.0")).toBe("v0.1.0");
  });

  it("is empty with no version", () => {
    expect(versionLabel("")).toBe("");
  });
});
