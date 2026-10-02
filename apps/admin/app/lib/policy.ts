import type { PwStartClass } from "@sneakers-web/api-client";

/** A password policy's rules as the editor holds them. */
export interface PolicyRules {
  endLiteral: string;
  excludeChars: string;
  maxLength: number;
  minLength: number;
  name: string;
  requireDigit: boolean;
  requireLower: boolean;
  requireSymbol: boolean;
  requireUpper: boolean;
  rotationDays: number;
  startClass: PwStartClass;
}

const SETS = {
  digit: "0123456789",
  lower: "abcdefghijklmnopqrstuvwxyz",
  symbol: "!#$%&*+-=?@^_~.,:;",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

const without = (set: string, exclude: string) =>
  [...set].filter((c) => !exclude.includes(c)).join("");

const pools = (r: PolicyRules) => ({
  digit: without(SETS.digit, r.excludeChars),
  lower: without(SETS.lower, r.excludeChars),
  symbol: without(SETS.symbol, r.excludeChars),
  upper: without(SETS.upper, r.excludeChars),
});

export type PolicyProblems = Partial<
  Record<"excludeChars" | "maxLength" | "minLength" | "name", string>
>;

/** What makes the rules impossible to meet, by field. Empty means a password can be made. */
export const policyProblems = (r: PolicyRules): PolicyProblems => {
  const out: PolicyProblems = {};
  if (!r.name.trim()) out.name = "Give the policy a name.";
  if (!Number.isInteger(r.minLength) || r.minLength < 1) out.minLength = "At least 1.";
  if (r.maxLength && r.maxLength < r.minLength)
    out.maxLength = `Must be at least the min (${r.minLength}).`;
  const p = pools(r);
  const required = [
    r.requireUpper && p.upper,
    r.requireLower && p.lower,
    r.requireDigit && p.digit,
    r.requireSymbol && p.symbol,
  ].filter((v) => v !== false);
  if (required.includes(""))
    out.excludeChars = "That rules out every character of a class the policy requires.";
  const room = (r.maxLength || 128) - r.endLiteral.length;
  if (!out.maxLength && required.length > room)
    out.maxLength = "Too short for the classes it requires.";
  return out;
};

const pick = (set: string, rand: () => number) => set[Math.floor(rand() * set.length)] ?? "";

const random = (): number => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return (a[0] as number) / 2 ** 32;
};

/** A password that follows the rules, to show what the policy makes. Null when it can't. */
export const examplePassword = (r: PolicyRules, rand: () => number = random): null | string => {
  if (Object.keys(policyProblems({ ...r, name: r.name || "x" })).length > 0) return null;
  const p = pools(r);
  const any =
    [
      r.requireUpper || !r.requireLower ? p.upper : "",
      p.lower,
      r.requireDigit || !r.requireSymbol ? p.digit : "",
      r.requireSymbol ? p.symbol : "",
    ].join("") || p.lower + p.upper + p.digit;
  const length = Math.max(r.minLength, Math.min(r.maxLength || 16, 16)) - r.endLiteral.length;
  const chars = [
    ...(r.requireUpper ? [pick(p.upper, rand)] : []),
    ...(r.requireLower ? [pick(p.lower, rand)] : []),
    ...(r.requireDigit ? [pick(p.digit, rand)] : []),
    ...(r.requireSymbol ? [pick(p.symbol, rand)] : []),
  ];
  while (chars.length < length) chars.push(pick(any, rand));
  for (let index = chars.length - 1; index > 0; index--) {
    const j = Math.floor(rand() * (index + 1));
    [chars[index], chars[j]] = [chars[j] as string, chars[index] as string];
  }
  const start = { any: "", digit: p.digit, letter: p.lower + p.upper, symbol: p.symbol }[
    r.startClass
  ];
  if (start && !start.includes(chars[0] as string)) {
    const swap = chars.findIndex((c) => start.includes(c));
    if (swap > 0) [chars[0], chars[swap]] = [chars[swap] as string, chars[0] as string];
    else chars[0] = pick(start, rand);
  }
  return chars.join("") + r.endLiteral;
};

/** The complexity chips the policies list shows. */
export const classChips = (
  r: Pick<PolicyRules, "requireDigit" | "requireLower" | "requireSymbol" | "requireUpper">,
) =>
  [
    r.requireUpper && "A-Z",
    r.requireLower && "a-z",
    r.requireDigit && "0-9",
    r.requireSymbol && "!#$",
  ].filter((v): v is string => !!v);
