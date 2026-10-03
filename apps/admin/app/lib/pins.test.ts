import { pinProblems } from "@/lib/pins";

describe("pinProblems", () => {
  it("accepts OpenSSH public keys, with or without a comment, ignoring blank lines", () => {
    expect(
      pinProblems("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA host1\n\necdsa-sha2-nistp256 AAAAE2Vj"),
    ).toEqual([]);
  });

  it("names the line with an unknown key type or no key", () => {
    expect(pinProblems("ssh-ed25519 AAAA\nhost1 ssh-ed25519 AAAA\nssh-rsa")).toEqual([
      "Line 2 doesn't start with a key type such as ssh-ed25519.",
      "Line 3 is missing the key itself after ssh-rsa.",
    ]);
  });
});
