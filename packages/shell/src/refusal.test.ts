import { GraphQLRequestError } from "@sneakers-web/api-client";

import { needsStepUp, refusalMessage, refusalOf } from "#shell/refusal";

const refused = (reason: string | undefined, code: string, message: string) =>
  new GraphQLRequestError([{ extensions: { code, metadata: { k: "v" }, reason }, message }]);

describe("refusals", () => {
  it("keeps the code, reason, metadata and the backend's own words", () => {
    const r = refusalOf(
      refused(
        "RECOVERY_ROLE_REQUIRED",
        "PERMISSION_DENIED",
        "rpc error: code = PermissionDenied desc = recovery role required",
      ),
    );
    expect(r).toEqual({
      code: "PERMISSION_DENIED",
      detail: "recovery role required",
      metadata: { k: "v" },
      reason: "RECOVERY_ROLE_REQUIRED",
    });
  });

  it("is null for anything that isn't a GraphQL refusal", () => {
    expect(refusalOf(new Error("boom"))).toBeNull();
  });

  it("explains a known reason in plain words", () => {
    const r = refusalOf(refused("RECOVERY_ROLE_REQUIRED", "PERMISSION_DENIED", "x"));
    expect(refusalMessage(r!)).toMatch(/recovery role/);
    expect(needsStepUp(refusalOf(refused("STEP_UP_REQUIRED", "FAILED_PRECONDITION", "x")))).toBe(
      true,
    );
  });

  it("passes the backend's text through for input errors", () => {
    const r = refusalOf(
      refused(
        undefined,
        "ALREADY_EXISTS",
        "rpc error: code = AlreadyExists desc = a group with that name already exists",
      ),
    );
    expect(refusalMessage(r!)).toBe("A group with that name already exists");
  });

  it("falls back to the code's meaning", () => {
    const r = refusalOf(refused(undefined, "PERMISSION_DENIED", "rpc error: desc = no"));
    expect(refusalMessage(r!)).toBe("You don't have permission to do that.");
  });
});

describe("workflow refusals for requests, check-outs and check-ins", () => {
  it.each([
    [
      "SELF_APPROVAL",
      "PERMISSION_DENIED",
      "You can't decide your own request. Another approver has to.",
    ],
    [
      "NOT_APPROVER",
      "PERMISSION_DENIED",
      "Only an approver for this secret can decide this request.",
    ],
    ["CHECKOUT_TYPE_DISABLED", "FAILED_PRECONDITION", "This kind of secret can't be checked out."],
    [
      "CHECKOUT_NO_ACCESS",
      "PERMISSION_DENIED",
      "You can't check this secret out. Ask for access first.",
    ],
    [
      "CHECKIN_NOT_HOLDER",
      "PERMISSION_DENIED",
      "Only the person who checked it out can check it in.",
    ],
  ])("explains %s", (reason, code, text) => {
    const r = refusalOf(refused(reason, code, "rpc error: code = X desc = backend words"));
    expect(refusalMessage(r!)).toBe(text);
  });
});

describe("sign-in method refusals", () => {
  it("says why the last second factor can't go when MFA is required", () => {
    const r = refusalOf(refused("MFA_LAST_FACTOR", "FAILED_PRECONDITION", "x"));
    expect(refusalMessage(r!)).toBe(
      "Your administrator requires a second factor. Add another one before removing this one.",
    );
  });
});
