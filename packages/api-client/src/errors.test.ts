import { GraphQLRequestError, isRefusal, legacyCode } from "#api/errors";

describe("GraphQLRequestError", () => {
  it("keeps the reason's domain, the trace id and the operation for diagnostics", () => {
    const error = new GraphQLRequestError(
      [
        {
          extensions: {
            code: "FAILED_PRECONDITION",
            domain: "sneakers.workflow",
            reason: "CHECKOUT_LEASE_HELD",
            traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
          },
          message: "held",
        },
      ],
      "CheckOut",
    );
    expect(error.domain).toBe("sneakers.workflow");
    expect(error.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(error.operation).toBe("CheckOut");
  });

  it("takes the stable code, reason and metadata from the gateway's extensions", () => {
    const error = new GraphQLRequestError([
      {
        extensions: {
          code: "FAILED_PRECONDITION",
          metadata: { holder_user_id: "mock-user-bob" },
          reason: "CHECKOUT_LEASE_HELD",
        },
        message: "rpc error: code = FailedPrecondition desc = held",
      },
    ]);
    expect(error.code).toBe("FAILED_PRECONDITION");
    expect(error.reason).toBe("CHECKOUT_LEASE_HELD");
    expect(error.metadata.holder_user_id).toBe("mock-user-bob");
    expect(isRefusal(error, "CHECKOUT_LEASE_HELD")).toBe(true);
    expect(isRefusal(error, "CHECKIN_NOT_HOLDER")).toBe(false);
  });

  it("falls back to the code in the message text when there are no extensions", () => {
    const error = new GraphQLRequestError([
      { message: "rpc error: code = PermissionDenied desc = no" },
    ]);
    expect(error.code).toBe("PERMISSION_DENIED");
    expect(error.reason).toBeUndefined();
    expect(legacyCode("no code here")).toBeUndefined();
  });
});
