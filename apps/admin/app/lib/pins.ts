/** The key types OpenSSH writes in known_hosts and authorized_keys. */
const TYPES = [
  "ssh-ed25519",
  "ssh-rsa",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
];

/** Also the security-key types, which all start with "sk-". */
const knownType = (type: string) => TYPES.includes(type) || type.startsWith("sk-");

/** What's wrong with each pinned key line, as sentences naming the line. Empty means all good. */
export const pinProblems = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const [type, data] = line.split(/\s+/);
      if (!type || !knownType(type))
        return [`Line ${index + 1} doesn't start with a key type such as ssh-ed25519.`];
      if (!data || !/^[A-Za-z0-9+/=]+$/.test(data))
        return [`Line ${index + 1} is missing the key itself after ${type}.`];
      return [];
    });
