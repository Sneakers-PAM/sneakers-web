import { generatePassword, type Policy, policyChecks, policyFor } from "@/features/editors/policy";

const strong: Policy = {
  endLiteral: null,
  excludeChars: "\"'\\",
  id: "mock-policy-strong",
  isDefault: true,
  maxLength: 64,
  minLength: 14,
  name: "Strong",
  requireDigit: true,
  requireLower: true,
  requireSymbol: true,
  requireUpper: true,
  startClass: "letter",
};
const pin: Policy = {
  endLiteral: null,
  excludeChars: null,
  id: "mock-policy-pin",
  isDefault: false,
  maxLength: 8,
  minLength: 6,
  name: "PIN",
  requireDigit: true,
  requireLower: false,
  requireSymbol: false,
  requireUpper: false,
  startClass: "digit",
};

describe("password policies in the editor", () => {
  it("uses the field's own policy, then the default one", () => {
    expect(policyFor({ policyId: "mock-policy-pin" }, [strong, pin])?.name).toBe("PIN");
    expect(policyFor({ policyId: null }, [strong, pin])?.name).toBe("Strong");
    expect(policyFor({ policyId: "mock-policy-gone" }, [pin])).toBeUndefined();
  });

  it("lists what a value still needs, the way the form shows it", () => {
    const checks = policyChecks("hunter2hunter2", strong);
    expect(checks.map((c) => [c.label, c.met])).toEqual([
      ["an uppercase letter", false],
      ["a lowercase letter", true],
      ["a digit", true],
      ["a symbol", false],
      ["14+ characters", true],
    ]);
  });

  it("adds the rules a value breaks beyond the classes", () => {
    const failing = policyChecks("1'abcdefgh", { ...strong, minLength: 4 }).filter((c) => !c.met);
    expect(failing.map((c) => c.label)).toEqual(
      expect.arrayContaining(["an uppercase letter", "start with a letter", "no ' characters"]),
    );
    expect(policyChecks("123456789", pin).find((c) => !c.met)?.label).toBe("at most 8 characters");
  });

  it("generates passwords that pass their policy", () => {
    for (let index = 0; index < 50; index++) {
      for (const p of [strong, pin]) {
        const value = generatePassword(p);
        expect(policyChecks(value, p).every((c) => c.met)).toBe(true);
      }
    }
  });

  it("generates a long mixed password when there is no policy", () => {
    const value = generatePassword();
    expect(value.length).toBeGreaterThanOrEqual(20);
    expect(value).toMatch(/[A-Z]/);
    expect(value).toMatch(/\d/);
  });
});
