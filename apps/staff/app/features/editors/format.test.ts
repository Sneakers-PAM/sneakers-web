import { formatField } from "@/features/editors/format";

describe("formatting template fields as they're typed", () => {
  it("groups a card number in fours, digits only, up to 19", () => {
    expect(formatField("number", "4111x1111 11111111")).toBe("4111 1111 1111 1111");
    expect(formatField("number", "1".repeat(25))).toBe("1111 1111 1111 1111 111");
  });

  it("puts the slash after the month of an expiry, up to MMYYYY", () => {
    expect(formatField("expiry", "0")).toBe("0");
    expect(formatField("expiry", "09")).toBe("09");
    expect(formatField("expiry", "0929")).toBe("09/29");
    expect(formatField("expiry", "09/20291")).toBe("09/2029");
  });

  it("dashes an SSN as XXX-XX-XXXX, up to nine digits", () => {
    expect(formatField("ssn", "123")).toBe("123");
    expect(formatField("ssn", "1234")).toBe("123-4");
    expect(formatField("ssn", "123456789012")).toBe("123-45-6789");
  });

  it("formats a clean 10-digit US phone, and leaves anything else as typed", () => {
    expect(formatField("phone", "5550100123")).toBe("(555) 010-0123");
    expect(formatField("phone", "+44 20 7946 0000")).toBe("+44 20 7946 0000");
  });

  it("leaves every other field as typed", () => {
    expect(formatField("username", "a 1-2")).toBe("a 1-2");
  });
});
