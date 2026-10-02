const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#$%&*+-=?@^_";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

const pick = (set: string, random: number): string => set[random % set.length] as string;

/**
 * A strong initial password: 16 characters with every class present, and none of the
 * look-alikes (l, 1, I, O, 0). Uses the platform's cryptographic random source.
 */
export const randomPassword = (length = 16): string => {
  const r = new Uint32Array(length + 4);
  globalThis.crypto.getRandomValues(r);
  const chars = [
    pick(LOWER, r[0] as number),
    pick(UPPER, r[1] as number),
    pick(DIGITS, r[2] as number),
    pick(SYMBOLS, r[3] as number),
  ];
  for (let index = 4; index < length; index++) chars.push(pick(ALL, r[index] as number));
  // Fisher-Yates with the remaining random words, so the classes aren't always up front.
  for (let index = chars.length - 1; index > 0; index--) {
    const j = (r[index] as number) % (index + 1);
    [chars[index], chars[j]] = [chars[j] as string, chars[index] as string];
  }
  return chars.join("");
};
