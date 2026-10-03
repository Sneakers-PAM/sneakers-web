import { natoWords, partialMask, phoneticFor } from "@/features/secret/phonetic";

describe("phonetic spelling", () => {
  it("names letters, capitals, digits and symbols the way the keypad shows them", () => {
    expect(phoneticFor("k")).toEqual({ kind: "lower", word: "kilo" });
    expect(phoneticFor("R")).toEqual({ kind: "upper", word: "romeo (cap)" });
    expect(phoneticFor("7")).toEqual({ kind: "digit", word: "seven" });
    expect(phoneticFor("#")).toEqual({ kind: "symbol", word: "hash" });
    expect(phoneticFor("!")).toEqual({ kind: "symbol", word: "exclamation" });
    expect(phoneticFor(" ")).toEqual({ kind: "symbol", word: "space" });
    expect(phoneticFor("é")).toEqual({ kind: "symbol", word: "é" });
  });

  it("reads a value aloud with capitals called out", () => {
    expect(natoWords("aB3!")).toBe("alpha, capital bravo, three, exclamation");
  });

  it("masks the middle of a super-sensitive value", () => {
    expect(partialMask("RK-4F9A-77C2-B1E0")).toBe("RK-4•••••••••B1E0");
    expect(partialMask("short")).toBe("•••••");
  });
});
