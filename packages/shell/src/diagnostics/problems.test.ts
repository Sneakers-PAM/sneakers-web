import { GraphQLRequestError } from "@sneakers-web/api-client";

import { problemFor, resetProblems } from "#shell/diagnostics/problems";
import { refusalMessage, refusalOf } from "#shell/refusal";

const refusal = (reason: string, traceId: string) =>
  refusalOf(
    new GraphQLRequestError(
      [{ extensions: { code: "FAILED_PRECONDITION", reason, traceId }, message: "x" }],
      "CheckOut",
    ),
  )!;

describe("problemFor", () => {
  beforeEach(() => resetProblems());

  it("finds the refusal behind the message a screen showed", () => {
    const message = refusalMessage(refusal("CHECKOUT_LEASE_HELD", "t-1"));
    refusalMessage(refusal("NOT_SITE_ADMIN", "t-2"));
    expect(problemFor(message)).toEqual({
      code: "FAILED_PRECONDITION",
      message,
      operation: "CheckOut",
      reason: "CHECKOUT_LEASE_HELD",
      traceId: "t-1",
    });
  });

  it("is just the message when no refusal produced it", () => {
    expect(problemFor("Couldn't copy.")).toEqual({ message: "Couldn't copy." });
  });

  it("forgets a refusal after ten minutes", () => {
    vi.useFakeTimers();
    try {
      const message = refusalMessage(refusal("CHECKOUT_LEASE_HELD", "t-1"));
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(problemFor(message)).toEqual({ message });
    } finally {
      vi.useRealTimers();
    }
  });
});
