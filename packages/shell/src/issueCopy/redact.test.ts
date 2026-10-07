import { redactIssueText } from "#shell/issueCopy/redact";

// Fake secrets are assembled at run time so no literal one is ever committed.
const joined = (...parts: string[]) => parts.join("");
const B64 = joined("dGhpc2lz", "YWZha2Vz", "ZWNyZXQx");
const HEX = joined("0123456789ab", "cdef01234567");

describe("the UI issue copy redaction", () => {
  it("redacts a Basic authorization value", () => {
    expect(redactIssueText(joined("Authorization: Basic ", B64))).toBe(
      "Authorization: Basic [redacted]",
    );
  });

  it("redacts a cookie-style key=value of 8 or more characters", () => {
    expect(redactIssueText(joined("sent theme=dark; pref=", "abcdefgh12"))).toBe(
      "sent theme=dark; pref=[redacted]",
    );
  });

  it("collapses URL userinfo to the scheme and [host]", () => {
    expect(
      redactIssueText(joined("dial postgres://", "admin:", "hunter22", "@db.example.org:5432/x")),
    ).toBe("dial postgres://[host]:5432/x");
  });

  it("strips URL fragments", () => {
    expect(redactIssueText(joined("at /callback#access_", "token=", "abc"))).toBe("at /callback");
  });

  it("redacts long base64 and hex runs", () => {
    expect(redactIssueText(joined("blob ", B64, " and ", HEX))).toBe(
      "blob [redacted] and [redacted]",
    );
  });

  it("replaces a PEM block, even an unterminated one, with [pem]", () => {
    const begin = joined("-----BEGIN ", "PRIVATE KEY-----");
    expect(redactIssueText(joined("bad key ", begin, "\nMIIEv", "QIBADANBgkq"))).toBe(
      "bad key [pem]",
    );
    const end = joined("-----END ", "PRIVATE KEY-----");
    expect(redactIssueText(joined(begin, "\nabc\n", end, " tail"))).toBe("[pem] tail");
  });

  it("replaces host names with [host] and addresses with [ip]", () => {
    expect(redactIssueText("fetch https://vault.sneakers.example.org/v1 failed")).toBe(
      "fetch https://[host]/v1 failed",
    );
    expect(redactIssueText("connect 192.0.2.10:443 and 2001:db8::1")).toBe(
      "connect [ip]:443 and [ip]",
    );
  });

  it("replaces two-label host names too", () => {
    expect(redactIssueText("lookup wiki.example failed")).toBe("lookup [host] failed");
    expect(redactIssueText(joined("lookup acme", ".corp failed"))).toBe("lookup [host] failed");
  });

  it("redacts 20-character access key ids", () => {
    expect(redactIssueText(joined("key ", "AKIA", "ABCDEFGHIJKLMNOP"))).toBe("key [redacted]");
  });

  it("replaces an email address whole, so its username doesn't survive", () => {
    expect(redactIssueText("no account for j.smith@sneakers.example.org")).toBe(
      "no account for [email]",
    );
  });

  it("leaves ordinary error text and code names alone", () => {
    for (const text of [
      "TypeError: a.b is not a function",
      "Cannot read properties of undefined (reading 'name')",
      "Request failed at 12:34:56 with status 503",
      "Loading chunk main.js failed",
      "Error #123 while saving",
    ]) {
      expect(redactIssueText(text)).toBe(text);
    }
  });
});
