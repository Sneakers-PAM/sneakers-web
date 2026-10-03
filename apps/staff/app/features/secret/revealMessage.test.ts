import { revealMessage } from "@/features/secret/revealMessage";

describe("the reveal refusal message", () => {
  it("asks for a check-out when the mock says the lease is missing", () => {
    expect(
      revealMessage({
        code: "FAILED_PRECONDITION",
        detail: "check the secret out before revealing its values",
        metadata: {},
        reason: "CHECKOUT_REQUIRED",
      }),
    ).toBe("Check this secret out first, then reveal it.");
  });

  it("leaves every other refusal to the shared messages", () => {
    expect(
      revealMessage({ code: "PERMISSION_DENIED", detail: "", metadata: {}, reason: "NO_ACCESS" }),
    ).not.toBe("Check this secret out first, then reveal it.");
  });
});
