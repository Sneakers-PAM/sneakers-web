import { isNotAvailable, isStepUpRequired, OsadminError, parseOsadminError } from "@/lib/osadmin/errors";

describe("parseOsadminError", () => {
  it("reads the Connect code and message from a JSON error body", async () => {
    const response = new Response(JSON.stringify({ code: "unimplemented", message: "not built yet" }), {
      status: 501,
    });
    const error = await parseOsadminError(response);
    expect(error.code).toBe("unimplemented");
    expect(error.message).toBe("not built yet");
  });

  it("pulls the go-apperr symbol out of the message", async () => {
    const response = new Response(
      JSON.stringify({ code: "permission_denied", message: "ACCESS_STEPUP_REQUIRED: sign in again" }),
      { status: 403 },
    );
    const error = await parseOsadminError(response);
    expect(error.symbol).toBe("ACCESS_STEPUP_REQUIRED");
  });

  it("falls back to the status code when the body isn't JSON", async () => {
    const response = new Response("<html>502</html>", { status: 502 });
    const error = await parseOsadminError(response);
    expect(error.code).toBe("unknown");
    expect(error.message).toContain("502");
  });
});

describe("isNotAvailable", () => {
  it("is true only for an unimplemented Connect error", () => {
    expect(isNotAvailable(new OsadminError("unimplemented", "x"))).toBe(true);
    expect(isNotAvailable(new OsadminError("not_found", "x"))).toBe(false);
    expect(isNotAvailable(new Error("x"))).toBe(false);
  });
});

describe("isStepUpRequired", () => {
  it("is true only for permission_denied with the step-up symbol", () => {
    expect(
      isStepUpRequired(new OsadminError("permission_denied", "ACCESS_STEPUP_REQUIRED", "ACCESS_STEPUP_REQUIRED")),
    ).toBe(true);
    expect(isStepUpRequired(new OsadminError("permission_denied", "ACCESS_FORBIDDEN", "ACCESS_FORBIDDEN"))).toBe(
      false,
    );
  });
});
