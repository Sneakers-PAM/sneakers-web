import { issuePath, routePattern } from "#shell/issueCopy/path";

describe("the UI issue copy path", () => {
  it("swaps each param's value back for its placeholder", () => {
    expect(
      routePattern("/secrets/01HZX3K6Q8V2M4N7P9R1S3T5W7", { id: "01HZX3K6Q8V2M4N7P9R1S3T5W7" }),
    ).toBe("/secrets/:id");
  });

  it("reports an unmatched path as *, never the pathname", () => {
    expect(issuePath("/users/j_smith/keys", { "*": "users/j_smith/keys" })).toBe("*");
    expect(issuePath(undefined, {})).toBe("*");
  });
});
