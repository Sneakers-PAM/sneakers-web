import { appKeyProblem, parseAppKey } from "@/features/editors/githubAppKey";
import { armored } from "@/features/editors/sshKey";
import { EC_OID, pem, pkcs1, pkcs8, RSA_OID } from "@/test/appKeys";

describe("a GitHub App private key", () => {
  it("reads the .pem GitHub hands out: an RSA key, and its size", () => {
    expect(parseAppKey(pem("RSA PRIVATE KEY", pkcs1()))).toEqual({ bits: 2048, ok: true });
    expect(parseAppKey(`\n  ${pem("RSA PRIVATE KEY", pkcs1(4096))}\n`)).toEqual({
      bits: 4096,
      ok: true,
    });
  });

  it("reads an RSA key in PKCS#8 too", () => {
    expect(parseAppKey(pem("PRIVATE KEY", pkcs8(RSA_OID, pkcs1())))).toEqual({
      bits: 2048,
      ok: true,
    });
  });

  it.each([
    ["nothing like a key", "hello", "not-a-key"],
    ["a public key", armored("PUBLIC KEY", "AAAA"), "public-key"],
    ["a certificate", armored("CERTIFICATE", "AAAA"), "certificate"],
    ["an SSH key", armored("OPENSSH PRIVATE KEY", "AAAA"), "ssh-key"],
    ["an encrypted key", armored("ENCRYPTED PRIVATE KEY", "AAAA"), "encrypted"],
    [
      "a legacy encrypted key",
      armored("RSA PRIVATE KEY", "Proc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,00\n\nAAAA"),
      "encrypted",
    ],
    ["an EC key", pem("PRIVATE KEY", pkcs8(EC_OID, [0x30, 0x00])), "not-rsa"],
    ["a damaged body", armored("RSA PRIVATE KEY", "!!!not base64!!!"), "damaged"],
    ["a cut-off body", pem("RSA PRIVATE KEY", pkcs1().slice(0, 40)), "damaged"],
  ])("refuses %s", (_, text, reason) => {
    expect(parseAppKey(text)).toEqual({ ok: false, reason });
  });

  it("says what's wrong in words, and nothing for a good key", () => {
    expect(appKeyProblem(pem("RSA PRIVATE KEY", pkcs1()))).toBeNull();
    expect(appKeyProblem(armored("OPENSSH PRIVATE KEY", "AAAA"))).toMatch(/SSH key/);
    expect(appKeyProblem("")).toBeNull();
  });
});
