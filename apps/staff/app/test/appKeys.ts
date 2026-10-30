import { armored } from "@/features/editors/sshKey";

/*
 * Private key files shaped like the ones GitHub hands out for an App, for tests. They hold a
 * made-up modulus and no real key: only the DER shape the editor's check reads.
 */

/** DER: a tag, its length and its contents. */
const tlv = (tag: number, body: number[]): number[] => {
  const n = body.length;
  const length = n < 128 ? [n] : n < 256 ? [129, n] : [130, (n >> 8) & 255, n & 255];
  return [tag, ...length, ...body];
};
const int = (bytes: number[]) => tlv(2, bytes);
const seq = (...parts: number[][]) => tlv(48, parts.flat());
const b64 = (bytes: number[]) => btoa(String.fromCodePoint(...bytes));
const wrap = (s: string) => s.match(/.{1,64}/g)!.join("\n");

/** A modulus of `bits` bits: not a real key, only the shape the parser reads. */
const modulus = (bits: number) => [
  0,
  193,
  ...Array.from({ length: bits / 8 - 1 }, (_, index) => (index * 37) & 255),
];

/** A PKCS#1 RSAPrivateKey of `bits` bits, as DER. */
export const pkcs1 = (bits = 2048): number[] =>
  seq(int([0]), int(modulus(bits)), int([1, 0, 1]), ...Array.from({ length: 6 }, () => int([5])));

export const RSA_OID = [6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1];
export const EC_OID = [6, 7, 42, 134, 72, 206, 61, 2, 1];

/** A PKCS#8 PrivateKeyInfo for the algorithm `oid`, holding `inner`. */
export const pkcs8 = (oid: number[], inner: number[]): number[] =>
  seq(int([0]), seq(oid, [5, 0]), tlv(4, inner));

/** `der` as a PEM block labelled `label`. */
export const pem = (label: string, der: number[]): string => armored(label, wrap(b64(der)));

/** The .pem GitHub downloads for an App: an unencrypted PKCS#1 RSA key. */
export const appKeyPem = (bits = 2048): string => pem("RSA PRIVATE KEY", pkcs1(bits));
