import { armored, keyPairMatch, parsePrivateKey, parsePublicKey } from "@/features/editors/sshKey";

// Invented key-shaped text: the structure of an OpenSSH key with made-up bytes, not a key.
const string_ = (bytes: number[]) => [
  0,
  0,
  (bytes.length >> 8) & 255,
  bytes.length & 255,
  ...bytes,
];
const ascii = (s: string) => [...s].map((c) => c.codePointAt(0) ?? 0);
const b64 = (bytes: number[]) => btoa(String.fromCodePoint(...bytes));
const blob = (seed: number) => [
  ...string_(ascii("ssh-ed25519")),
  ...string_(Array.from({ length: 32 }, (_, index) => (index * seed) & 255)),
];
const openssh = (seed: number, cipher = "none") => {
  const body = [
    ...ascii("openssh-key-v1"),
    0,
    ...string_(ascii(cipher)),
    ...string_(ascii(cipher === "none" ? "none" : "bcrypt")),
    ...string_([]),
    0,
    0,
    0,
    1,
    ...string_(blob(seed)),
    ...string_(ascii("private part")),
  ];
  const lines = b64(body).match(/.{1,70}/g) ?? [];
  return armored("OPENSSH PRIVATE KEY", lines.join("\n"));
};
const publicLine = (seed: number) => `ssh-ed25519 ${b64(blob(seed))} deploy@example.org`;

const pem = (label: string, extra = "") => armored(label, `${extra}TW9jayBrZXk=`);

describe("SSH key checks", () => {
  it("reads an OpenSSH private key and whether it's encrypted", () => {
    expect(parsePrivateKey(openssh(3))).toMatchObject({ encrypted: false, format: "openssh" });
    expect(parsePrivateKey(openssh(3, "aes256-ctr"))).toMatchObject({ encrypted: true });
  });

  it("knows a PEM key and its encrypted forms", () => {
    expect(parsePrivateKey(pem("RSA PRIVATE KEY"))).toMatchObject({
      encrypted: false,
      format: "pem",
    });
    expect(
      parsePrivateKey(
        pem("RSA PRIVATE KEY", "Proc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,00\n\n"),
      ),
    ).toMatchObject({ encrypted: true });
    expect(parsePrivateKey(pem("ENCRYPTED PRIVATE KEY"))).toMatchObject({ encrypted: true });
  });

  it("refuses text that isn't a private key", () => {
    expect(parsePrivateKey("hunter2")).toBeNull();
    expect(parsePrivateKey(publicLine(3))).toBeNull();
  });

  it("reads a public key line", () => {
    expect(parsePublicKey(publicLine(3))).toMatchObject({
      comment: "deploy@example.org",
      type: "ssh-ed25519",
    });
    expect(parsePublicKey("not a key")).toBeNull();
  });

  it("checks a public key against the private key it came with", () => {
    expect(keyPairMatch(openssh(3), publicLine(3))).toBe("match");
    expect(keyPairMatch(openssh(3), publicLine(5))).toBe("mismatch");
    expect(keyPairMatch(openssh(3, "aes256-ctr"), publicLine(5))).toBe("mismatch");
    expect(keyPairMatch(armored("RSA PRIVATE KEY", "TW9jaw=="), publicLine(3))).toBe("unknown");
  });
});
