const DAY = 86_400_000;

/** A certificate this close to its end reads as expiring rather than valid. */
export const EXPIRING_DAYS = 30;

export interface CertExpiry {
  /** Whole days left (negative once expired), or null when the date is unknown. */
  days: null | number;
  label: string;
  tone: "danger" | "neutral" | "ok" | "warn";
}

export const certExpiry = (notAfter: string | undefined, now = Date.now()): CertExpiry => {
  const t = notAfter ? Date.parse(notAfter) : Number.NaN;
  if (Number.isNaN(t)) return { days: null, label: "Unknown", tone: "neutral" };
  const days = Math.floor((t - now) / DAY);
  if (t < now) return { days, label: "Expired", tone: "danger" };
  if (days <= EXPIRING_DAYS) return { days, label: `Expiring · ${days}d`, tone: "warn" };
  return { days, label: `Valid · ${days}d`, tone: "ok" };
};

export const keyLabel = (algorithm?: string, bits?: string): string => {
  if (!algorithm) return "Unknown";
  if (algorithm.toUpperCase().startsWith("EC")) return `${algorithm} P-${bits}`;
  return bits ? `${algorithm} ${bits}` : algorithm;
};

export interface ExportFormat {
  hint: string;
  /** Carries the private key, so it needs one on file. */
  key: boolean;
  label: string;
  /** The vault refuses these without a new passphrase. */
  passphrase: "optional" | "required" | false;
  value: string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    hint: "No private key. Safe to share.",
    key: false,
    label: "PEM, certificate + chain",
    passphrase: false,
    value: "pem-fullchain",
  },
  {
    hint: "Key re-encrypted with a passphrase.",
    key: true,
    label: "PEM with private key",
    passphrase: "optional",
    value: "pem",
  },
  {
    hint: "Certificate, chain and key in one file.",
    key: true,
    label: "PKCS#12 / PFX",
    passphrase: "required",
    value: "pkcs12",
  },
  { hint: "Certificate only, binary.", key: false, label: "DER", passphrase: false, value: "der" },
  {
    hint: "Certificate and key, passphrase protected.",
    key: true,
    label: "Java keystore (JKS)",
    passphrase: "required",
    value: "jks",
  },
];

export const exportBlocked = (format: ExportFormat, hasKey: boolean, passphrase: string) =>
  (format.key && !hasKey) || (format.passphrase === "required" && !passphrase.trim());

/** The fields the certificate card shows, so the field list doesn't show them twice. */
export const CERT_META_KEYS = new Set([
  "fingerprintSha256",
  "hasPrivateKey",
  "isCA",
  "issuer",
  "keyAlgorithm",
  "keyBits",
  "notAfter",
  "notBefore",
  "sans",
  "serialNumber",
  "subject",
]);
