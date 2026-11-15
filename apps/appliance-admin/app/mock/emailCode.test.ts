import { email } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { MOCK_EMAIL_CODE } from "@/mock/edge.mock";
import { signInAs } from "@/test/session";

const SETTINGS = {
  caPem: "",
  from: "no-reply@example.org",
  host: "relay.example.org",
  pinSha256: "",
  port: 587,
  tls: "EMAIL_TLS_STARTTLS",
  username: "mailer",
  verify: false,
} as const;

const refusal = async (promise: Promise<unknown>) => {
  let error: unknown;
  try {
    await promise;
  } catch (error_) {
    error = error_;
  }
  expect(error).toBeInstanceOf(OsadminError);
  return error as OsadminError;
};

const symbolOf = async (promise: Promise<unknown>) => {
  const error = await refusal(promise);
  return error.symbol;
};

const attempt = (code: string) =>
  email.checkCode({ code, password: "relay-pass", settings: SETTINGS });

const sendTest = (password = "relay-pass", settings = SETTINGS) =>
  email.test({ password, settings, to: "admin@example.org" });

describe("the mock's test email code (EmailService.CheckEmailCode, #320)", () => {
  beforeEach(() => signInAs("alice"));

  it("answers a right code with the time its pass runs to, about ten minutes on", async () => {
    await sendTest();
    const before = Date.now();
    const { validUntil } = await email.checkCode({
      code: MOCK_EMAIL_CODE,
      password: "relay-pass",
      settings: SETTINGS,
    });
    const minutes = (Date.parse(validUntil) - before) / 60_000;
    expect(minutes).toBeGreaterThan(9.9);
    expect(minutes).toBeLessThan(10.1);
  });

  it("says EMAIL_CODE_EXPIRED when no test email was sent", async () => {
    const error = await refusal(
      email.checkCode({ code: MOCK_EMAIL_CODE, password: "relay-pass", settings: SETTINGS }),
    );
    expect(error.symbol).toBe("EMAIL_CODE_EXPIRED");
    expect(error.code).toBe("failed_precondition");
  });

  it("says EMAIL_CODE_WRONG for another code, and drops the code on the fifth wrong try", async () => {
    await sendTest();
    for (let tries = 0; tries < 5; tries++) {
      const error = await refusal(attempt("000000"));
      expect(error.symbol).toBe("EMAIL_CODE_WRONG");
      expect(error.code).toBe("invalid_argument");
    }
    expect(await symbolOf(attempt(MOCK_EMAIL_CODE))).toBe("EMAIL_CODE_EXPIRED");
  });

  it("works once", async () => {
    await sendTest();
    await attempt(MOCK_EMAIL_CODE);
    expect(await symbolOf(attempt(MOCK_EMAIL_CODE))).toBe("EMAIL_CODE_EXPIRED");
  });

  it("belongs to the settings and password the test was sent with", async () => {
    await sendTest();
    const otherPassword = email.checkCode({
      code: MOCK_EMAIL_CODE,
      password: "another",
      settings: SETTINGS,
    });
    expect(await symbolOf(otherPassword)).toBe("EMAIL_CODE_EXPIRED");
    const otherSettings = email.checkCode({
      code: MOCK_EMAIL_CODE,
      password: "relay-pass",
      settings: { ...SETTINGS, port: 25 },
    });
    expect(await symbolOf(otherSettings)).toBe("EMAIL_CODE_EXPIRED");
  });
});
