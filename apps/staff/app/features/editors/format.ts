/*
 * Template fields formatted as they're typed, keyed by field key. The formatted value is what's
 * stored. Each works off the raw digits, so paste and backspace behave.
 */

const digitsOf = (raw: string) => raw.replaceAll(/\D/g, "");

const FORMATS: Record<string, (raw: string) => string> = {
  /** Card expiry: MMYYYY at most, the slash after the month. */
  expiry: (raw) => {
    const d = digitsOf(raw).slice(0, 6);
    return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
  },
  /** Card number: 19 digits at most (the longest card number), in blocks of four. */
  number: (raw) =>
    digitsOf(raw)
      .slice(0, 19)
      .replaceAll(/(.{4})/g, "$1 ")
      .trim(),
  /** Only a clean 10-digit US number is reformatted; anything else stays as typed. */
  phone: (raw) => {
    const d = digitsOf(raw);
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
  },
  /** XXX-XX-XXXX, nine digits at most. */
  ssn: (raw) => {
    const d = digitsOf(raw).slice(0, 9);
    return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 9)].filter(Boolean).join("-");
  },
};

/** `raw` as the field stores it: formatted for the keys above, unchanged otherwise. */
export const formatField = (key: string, raw: string): string => FORMATS[key]?.(raw) ?? raw;
