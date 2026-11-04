import {
  emailCertificateRefusalOf,
  isNotAvailable,
  isStepUpRequired,
  OsadminError,
  parseOsadminError,
  plainMessage,
  reasonOf,
  refusalOf,
  validationChecksOf,
} from "@/lib/osadmin/errors";

describe("parseOsadminError", () => {
  it("reads the Connect code and message from a JSON error body", async () => {
    const response = Response.json(
      { code: "unimplemented", message: "not built yet" },
      {
        status: 501,
      },
    );
    const error = await parseOsadminError(response);
    expect(error.code).toBe("unimplemented");
    expect(error.message).toBe("not built yet");
  });

  it("pulls the go-apperr symbol out of the message", async () => {
    const response = Response.json(
      {
        code: "permission_denied",
        message: "ACCESS_STEPUP_REQUIRED: sign in again",
      },
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

describe("a method the box doesn't have", () => {
  it("reads a bare 404 as unimplemented, as Connect does", async () => {
    const error = await parseOsadminError(new Response("404 page not found", { status: 404 }));
    expect(isNotAvailable(error)).toBe(true);
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
      isStepUpRequired(
        new OsadminError("permission_denied", "ACCESS_STEPUP_REQUIRED", "ACCESS_STEPUP_REQUIRED"),
      ),
    ).toBe(true);
    expect(
      isStepUpRequired(
        new OsadminError("permission_denied", "ACCESS_FORBIDDEN", "ACCESS_FORBIDDEN"),
      ),
    ).toBe(false);
  });
});

describe("a refused certificate", () => {
  it("reads the ValidationReport detail and the reason after the symbol", async () => {
    const response = Response.json(
      {
        code: "failed_precondition",
        details: [
          {
            debug: { checks: [{ detail: "covers www.example.org only", name: "names" }] },
            type: "sneakers.appliance.osadmin.v1.ValidationReport",
            value: "",
          },
        ],
        message: "TLS_NAMES (3806): the certificate covers www.example.org only",
      },
      { status: 400 },
    );
    const error = await parseOsadminError(response);
    expect(error.symbol).toBe("TLS_NAMES");
    expect(validationChecksOf(error)).toEqual([
      { detail: "covers www.example.org only", name: "names", passed: false },
    ]);
    expect(reasonOf(error)).toBe("the certificate covers www.example.org only");
  });

  it("has no checks when the error carries none", () => {
    expect(validationChecksOf(new OsadminError("internal", "boom"))).toEqual([]);
  });
});

describe("refusalOf", () => {
  const REFUSAL = "sneakers.appliance.osadmin.v1.SignInRefusal";
  const refused = (details: unknown[]) =>
    parseOsadminError(
      Response.json(
        { code: "unauthenticated", details, message: "SIGNIN_REFUSED" },
        {
          status: 401,
        },
      ),
    );

  it("reads the SignInRefusal detail's JSON debug form", async () => {
    const error = await refused([
      {
        debug: { attemptsLeft: 2, lockedUntil: "2026-10-07T14:33:00Z" },
        type: REFUSAL,
        value: "",
      },
    ]);
    expect(refusalOf(error)).toEqual({
      attemptsLeft: 2,
      lockedUntil: "2026-10-07T14:33:00Z",
      lockedUntilUnlocked: false,
      retryAfter: undefined,
    });
  });

  it("decodes the detail's binary value when there's no debug form", async () => {
    const error = await refused([{ type: REFUSAL, value: "CAIYAQ" }]);
    expect(refusalOf(error)).toMatchObject({ attemptsLeft: 2, lockedUntilUnlocked: true });
    const timed = await refused([{ type: REFUSAL, value: "IgMI6Ac" }]);
    expect(refusalOf(timed)?.retryAfter).toBe(new Date(1_000_000).toISOString());
  });

  it("is undefined without a SignInRefusal detail", async () => {
    expect(refusalOf(await refused([]))).toBeUndefined();
    expect(refusalOf(new Error("x"))).toBeUndefined();
  });
});

describe("emailCertificateRefusalOf", () => {
  const DETAIL = "sneakers.appliance.osadmin.v1.EmailCertificateRefusal";
  const refused = (message: string, details: unknown[]) =>
    parseOsadminError(
      Response.json(
        { code: "failed_precondition", details, message },
        {
          status: 400,
        },
      ),
    );

  it("reads the certificate, the pin and the reason from the detail's JSON debug form", async () => {
    const error = await refused("EMAIL_PIN_MISMATCH (3904): the relay presented another", [
      {
        debug: {
          certificate: {
            dnsNames: ["mail.example.org"],
            issuer: "CN=mail.example.org",
            notAfter: "2027-01-01T00:00:00Z",
            notBefore: "2026-01-01T00:00:00Z",
            sha256: "AA:BB",
            subject: "CN=mail.example.org",
          },
          pinnedSha256: "CC:DD",
          reason: "it isn't the pinned certificate",
        },
        type: DETAIL,
        value: "",
      },
    ]);
    expect(emailCertificateRefusalOf(error)).toEqual({
      certificate: {
        dnsNames: ["mail.example.org"],
        ipAddresses: [],
        issuer: "CN=mail.example.org",
        notAfter: "2027-01-01T00:00:00Z",
        notBefore: "2026-01-01T00:00:00Z",
        sha256: "AA:BB",
        subject: "CN=mail.example.org",
      },
      mismatch: true,
      pinnedSha256: "CC:DD",
      reason: "it isn't the pinned certificate",
    });
  });

  it("decodes the detail's binary value, repeated names and all, when there's no debug form", async () => {
    const error = await refused("EMAIL_UNTRUSTED (3903): the relay's certificate isn't trusted", [
      {
        type: DETAIL,
        value:
          "CjAKBENOPXISBENOPXIaAwjoByIDCNAPKgVBQTpCQjIBcjICcjI6CjE5Mi4wLjIuMjUSBUNDOkREGgtzZWxmLXNpZ25lZA==",
      },
    ]);
    expect(emailCertificateRefusalOf(error)).toEqual({
      certificate: {
        dnsNames: ["r", "r2"],
        ipAddresses: ["192.0.2.25"],
        issuer: "CN=r",
        notAfter: new Date(2_000_000).toISOString(),
        notBefore: new Date(1_000_000).toISOString(),
        sha256: "AA:BB",
        subject: "CN=r",
      },
      mismatch: false,
      pinnedSha256: "CC:DD",
      reason: "self-signed",
    });
  });

  it("is undefined for another refusal, or one without the detail", async () => {
    expect(emailCertificateRefusalOf(await refused("EMAIL_SEND (3902): no", []))).toBeUndefined();
    expect(
      emailCertificateRefusalOf(await refused("EMAIL_UNTRUSTED (3903): untrusted", [])),
    ).toBeUndefined();
    expect(emailCertificateRefusalOf(new Error("x"))).toBeUndefined();
  });
});

describe("plainMessage", () => {
  it("gives the box's reason as a sentence first, then the symbol without its number", () => {
    expect(
      plainMessage(
        new OsadminError("invalid_argument", "ACCESS_PASSWORD (3016): use at least 12 characters"),
      ),
    ).toBe("Use at least 12 characters. (ACCESS_PASSWORD)");
    expect(plainMessage(new OsadminError("failed_precondition", "UPGRADE_BUSY: wait for it"))).toBe(
      "Wait for it. (UPGRADE_BUSY)",
    );
  });

  it("puts a plain sentence in front of a refusal that is only its code", () => {
    expect(plainMessage(new OsadminError("invalid_argument", "ACCESS_PASSWORD (3016)"))).toBe(
      "The box didn't take that password. (ACCESS_PASSWORD)",
    );
    expect(plainMessage(new OsadminError("unknown", "SOMETHING_NEW (9999)"))).toBe(
      "The appliance refused this. (SOMETHING_NEW)",
    );
  });

  it("keeps a message with no code as it is, and words a non-error", () => {
    expect(plainMessage(new Error("The appliance didn't answer."))).toBe(
      "The appliance didn't answer.",
    );
    expect(plainMessage("boom")).toBe("Something went wrong.");
  });
});
