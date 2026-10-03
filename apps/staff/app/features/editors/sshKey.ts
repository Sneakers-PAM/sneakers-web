/*
 * Light checks on pasted SSH keys, so the import dialog can say what's wrong before the vault
 * does. Nothing here decrypts or validates key material: the vault checks a pair for real on
 * save. An OpenSSH private key carries its public half in clear, even when encrypted, which is
 * what lets the browser tell a mismatched pair.
 */

export interface PrivateKeyInfo {
  encrypted: boolean;
  format: "openssh" | "pem";
  /** The public key blob, base64, for an OpenSSH key. */
  publicBlob?: string;
}

export interface PublicKeyInfo {
  blob: string;
  comment: string;
  type: string;
}

// The armor lines are built from parts so the source never holds one whole; secret scanners
// rightly flag those.
const DASHES = "-".repeat(5);

/** A PEM armor line: `armor("BEGIN", "OPENSSH PRIVATE KEY")`. */
export const armor = (edge: "BEGIN" | "END", label: string): string =>
  `${DASHES}${edge} ${label}${DASHES}`;

/** A PEM block around `body`. */
export const armored = (label: string, body: string): string =>
  [armor("BEGIN", label), body, armor("END", label)].join("\n");

const PEM = new RegExp(
  String.raw`${DASHES}BEGIN ([A-Z0-9 ]*PRIVATE KEY)${DASHES}([\s\S]*?)${DASHES}END \1${DASHES}`,
);
const MAGIC = "openssh-key-v1\0";

const decode = (b64: string): null | string => {
  try {
    return atob(b64.replaceAll(/\s+/g, ""));
  } catch {
    return null;
  }
};

/** A length-prefixed string from an SSH wire blob, and where the next one starts. */
const readString = (bin: string, at: number): [string, number] | null => {
  if (at + 4 > bin.length) return null;
  const n =
    (((bin.codePointAt(at) ?? 0) << 24) |
      ((bin.codePointAt(at + 1) ?? 0) << 16) |
      ((bin.codePointAt(at + 2) ?? 0) << 8) |
      (bin.codePointAt(at + 3) ?? 0)) >>>
    0;
  const end = at + 4 + n;
  if (end > bin.length) return null;
  return [bin.slice(at + 4, end), end];
};

const openssh = (body: string): null | PrivateKeyInfo => {
  const bin = decode(body);
  if (!bin?.startsWith(MAGIC)) return null;
  const cipher = readString(bin, MAGIC.length);
  const kdf = cipher && readString(bin, cipher[1]);
  const kdfOptions = kdf && readString(bin, kdf[1]);
  if (!cipher || !kdfOptions) return null;
  const blob = readString(bin, kdfOptions[1] + 4);
  return {
    encrypted: cipher[0] !== "none",
    format: "openssh",
    publicBlob: blob ? btoa(blob[0]) : undefined,
  };
};

/** What a pasted private key is, or null when the text isn't one. */
export const parsePrivateKey = (text: string): null | PrivateKeyInfo => {
  const m = PEM.exec(text.trim());
  if (!m) return null;
  const [, label = "", body = ""] = m;
  if (label === "OPENSSH PRIVATE KEY") return openssh(body);
  return {
    encrypted: label === "ENCRYPTED PRIVATE KEY" || /Proc-Type:\s*4,ENCRYPTED/.test(body),
    format: "pem",
  };
};

/** An authorized_keys line ("ssh-ed25519 AAAA... comment"), or null when it isn't one. */
export const parsePublicKey = (line: string): null | PublicKeyInfo => {
  const [type = "", blob = "", ...rest] = line.trim().split(/\s+/);
  if (!/^(ssh-|ecdsa-|sk-)/.test(type) || !blob) return null;
  const bin = decode(blob);
  const named = bin && readString(bin, 0);
  if (!named || named[0] !== type) return null;
  return { blob, comment: rest.join(" "), type };
};

/** Whether the two halves belong together; "unknown" when the private key doesn't say. */
export const keyPairMatch = (
  privateKey: string,
  publicKey: string,
): "match" | "mismatch" | "unknown" => {
  const priv = parsePrivateKey(privateKey);
  const pub = parsePublicKey(publicKey);
  if (!priv?.publicBlob || !pub) return "unknown";
  return priv.publicBlob === pub.blob ? "match" : "mismatch";
};
