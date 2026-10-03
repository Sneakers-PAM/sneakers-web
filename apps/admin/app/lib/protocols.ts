/**
 * The protocols a connection can use. The connector picks its adapter by protocol: LDAP, LDAPS,
 * Kerberos and SSH work today; WinRM and SAMR are registered but report unreachable.
 */
export const PROTOCOLS = [
  { label: "LDAP", port: 389, ready: true, tls: false, value: "ldap" },
  { label: "LDAPS", port: 636, ready: true, tls: true, value: "ldaps" },
  { label: "Kerberos", port: 88, ready: true, tls: false, value: "kerberos" },
  { label: "SSH", port: 22, ready: true, tls: false, value: "ssh" },
  { label: "WinRM", port: 5986, ready: false, tls: true, value: "winrm" },
  { label: "SAMR", port: 445, ready: false, tls: false, value: "samr" },
] as const;

export const protocolOf = (value: string) => PROTOCOLS.find((p) => p.value === value);

/** The choices for a connection: the known protocols, plus the one it has if it's another. */
export const protocolChoices = (current: string) => [
  ...PROTOCOLS.map((p) => ({
    label: p.ready ? p.label : `${p.label} (no adapter yet)`,
    value: p.value as string,
  })),
  ...(current && !protocolOf(current)
    ? [{ label: `${current} (no adapter)`, value: current }]
    : []),
];

/** "a", "a and b", "a, b and c". */
export const listOf = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
