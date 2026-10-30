/*
 * A light check on a GitHub App private key, so the editor can say what's wrong before the
 * vault stores it. GitHub hands out an unencrypted RSA key as PKCS#1 PEM; PKCS#8 holds the
 * same key. Only the DER shape is read, for the key's size: nothing here uses the key.
 */

export type AppKey =
  | { bits: number; ok: true }
  | {
      ok: false;
      reason:
        | "certificate"
        | "damaged"
        | "encrypted"
        | "not-a-key"
        | "not-rsa"
        | "public-key"
        | "ssh-key";
    };

type Refusal = Extract<AppKey, { ok: false }>["reason"];

const DASHES = "-".repeat(5);
const BLOCK = new RegExp(
  String.raw`${DASHES}BEGIN ([A-Z0-9 ]+)${DASHES}([\s\S]*?)${DASHES}END \1${DASHES}`,
);

// The DER tags read here.
const INTEGER = 2;
const OCTET_STRING = 4;
const OBJECT_ID = 6;
const SEQUENCE = 48;

// rsaEncryption, 1.2.840.113549.1.1.1, as its DER body.
const RSA_OID = [42, 134, 72, 134, 247, 13, 1, 1, 1];

interface Node {
  body: Uint8Array;
  end: number;
  tag: number;
}

/** One DER element at `at`, or null if it runs past the end. */
const read = (der: Uint8Array, at: number): Node | null => {
  if (at + 2 > der.length) return null;
  const tag = der[at]!;
  let n = der[at + 1]!;
  let start = at + 2;
  // A long-form length: the low bits say how many bytes hold it.
  if (n & 128) {
    const width = n & 127;
    if (width === 0 || width > 3 || start + width > der.length) return null;
    n = 0;
    for (let index = 0; index < width; index++) n = (n << 8) | der[start + index]!;
    start += width;
  }
  const end = start + n;
  if (end > der.length) return null;
  return { body: der.subarray(start, end), end, tag };
};

/** The elements inside a SEQUENCE body, or null if one is cut off. */
const children = (body: Uint8Array): Node[] | null => {
  const out: Node[] = [];
  for (let at = 0; at < body.length;) {
    const node = read(body, at);
    if (!node) return null;
    out.push(node);
    at = node.end;
  }
  return out;
};

/** PKCS#1 RSAPrivateKey: version 0, then eight INTEGERs, the modulus first. */
const rsaBits = (der: Uint8Array): null | number => {
  const top = read(der, 0);
  if (top?.tag !== SEQUENCE) return null;
  const parts = children(top.body);
  if (!parts || parts.length < 9 || parts.some((p) => p.tag !== INTEGER)) return null;
  let n = parts[1]!.body;
  while (n.length > 0 && n[0] === 0) n = n.subarray(1);
  if (n.length === 0) return null;
  return (n.length - 1) * 8 + (32 - Math.clz32(n[0]!));
};

/** PKCS#8 PrivateKeyInfo: the algorithm, then the key as an OCTET STRING. */
const pkcs8 = (der: Uint8Array): AppKey => {
  const top = read(der, 0);
  const parts = top?.tag === SEQUENCE ? children(top.body) : null;
  const algorithm = parts?.[1]?.tag === SEQUENCE ? children(parts[1].body) : null;
  const oid = algorithm?.[0];
  if (!parts || parts[2]?.tag !== OCTET_STRING || oid?.tag !== OBJECT_ID)
    return { ok: false, reason: "damaged" };
  if (oid.body.length !== RSA_OID.length || oid.body.some((b, index) => b !== RSA_OID[index]))
    return { ok: false, reason: "not-rsa" };
  const bits = rsaBits(parts[2].body);
  return bits ? { bits, ok: true } : { ok: false, reason: "damaged" };
};

const bytes = (b64: string): null | Uint8Array => {
  try {
    return Uint8Array.from(atob(b64.replaceAll(/\s+/g, "")), (c) => c.codePointAt(0) ?? 0);
  } catch {
    return null;
  }
};

const LABELS: Record<string, Refusal> = {
  CERTIFICATE: "certificate",
  "ENCRYPTED PRIVATE KEY": "encrypted",
  "OPENSSH PRIVATE KEY": "ssh-key",
  "PUBLIC KEY": "public-key",
  "RSA PUBLIC KEY": "public-key",
};

/** What a pasted or uploaded .pem holds, as far as a GitHub App can use it. */
export const parseAppKey = (text: string): AppKey => {
  const m = BLOCK.exec(text);
  if (!m) return { ok: false, reason: "not-a-key" };
  const label = m[1]!;
  const body = m[2]!;
  const refused = LABELS[label];
  if (refused) return { ok: false, reason: refused };
  if (label !== "RSA PRIVATE KEY" && label !== "PRIVATE KEY") {
    return label.endsWith("PRIVATE KEY")
      ? { ok: false, reason: "not-rsa" }
      : { ok: false, reason: "not-a-key" };
  }
  if (/Proc-Type:\s*4,ENCRYPTED/.test(body)) return { ok: false, reason: "encrypted" };
  const der = bytes(body);
  if (!der) return { ok: false, reason: "damaged" };
  if (label === "PRIVATE KEY") return pkcs8(der);
  const bits = rsaBits(der);
  return bits ? { bits, ok: true } : { ok: false, reason: "damaged" };
};

const MESSAGES: Record<Refusal, string> = {
  certificate: "That's a certificate. Use the private key file GitHub downloaded for the App.",
  damaged: "The key is damaged or cut off. Download a new one from the App's settings.",
  encrypted: "That key is encrypted. Use the unencrypted .pem GitHub downloaded for the App.",
  "not-a-key": "That isn't a private key. Use the .pem file GitHub downloaded for the App.",
  "not-rsa": "GitHub App keys are RSA keys. Use the .pem file GitHub downloaded for the App.",
  "public-key": "That's a public key. Use the private key file GitHub downloaded for the App.",
  "ssh-key": "That's an SSH key. Use the .pem file GitHub downloaded for the App.",
};

/** Why `text` can't be the App's private key, or null when it can (or is empty). */
export const appKeyProblem = (text: string): null | string => {
  if (!text.trim()) return null;
  const k = parseAppKey(text);
  return k.ok ? null : MESSAGES[k.reason];
};
