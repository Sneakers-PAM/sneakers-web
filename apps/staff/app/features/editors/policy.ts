import type { EditorsPolicyFieldsFragment } from "@sneakers-web/api-client";

export type Policy = EditorsPolicyFieldsFragment;

export interface PolicyCheck {
  label: string;
  met: boolean;
}

const SETS = {
  digit: "0123456789",
  lower: "abcdefghijklmnopqrstuvwxyz",
  symbol: "!#$%&*+-=?@^_~.,:;",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

const START_LABEL = { digit: "a digit", letter: "a letter", symbol: "a symbol" } as const;

/** The policy a password field generates to: its own, else the vault's default. */
export const policyFor = (
  field: { policyId?: null | string },
  policies: Policy[],
): Policy | undefined =>
  field.policyId
    ? policies.find((p) => p.id === field.policyId)
    : policies.find((p) => p.isDefault);

const isSymbol = (c: string) => !/[A-Za-z0-9]/.test(c);

/**
 * What `value` meets and misses of `policy`. The classes and the minimum length always show,
 * so the person sees what's asked; the other rules show only once the value breaks them.
 */
export const policyChecks = (value: string, policy: Policy): PolicyCheck[] => {
  const checks: PolicyCheck[] = [];
  if (policy.requireUpper) checks.push({ label: "an uppercase letter", met: /[A-Z]/.test(value) });
  if (policy.requireLower) checks.push({ label: "a lowercase letter", met: /[a-z]/.test(value) });
  if (policy.requireDigit) checks.push({ label: "a digit", met: /\d/.test(value) });
  if (policy.requireSymbol)
    checks.push({ label: "a symbol", met: [...value].some((c) => isSymbol(c)) });
  checks.push({ label: `${policy.minLength}+ characters`, met: value.length >= policy.minLength });
  if (policy.maxLength && value.length > policy.maxLength)
    checks.push({ label: `at most ${policy.maxLength} characters`, met: false });
  const start = policy.startClass && policy.startClass !== "any" ? policy.startClass : null;
  if (start && value) {
    const first = value.charAt(0);
    const ok =
      start === "letter"
        ? /[A-Za-z]/.test(first)
        : start === "digit"
          ? /\d/.test(first)
          : isSymbol(first);
    if (!ok) checks.push({ label: `start with ${START_LABEL[start]}`, met: false });
  }
  if (policy.endLiteral && !value.endsWith(policy.endLiteral))
    checks.push({ label: `end with ${policy.endLiteral}`, met: false });
  for (const c of new Set(policy.excludeChars)) {
    if (value.includes(c)) checks.push({ label: `no ${c} characters`, met: false });
  }
  return checks;
};

/** Whether `value` meets every rule of `policy`. */
export const meetsPolicy = (value: string, policy: Policy): boolean =>
  policyChecks(value, policy).every((c) => c.met);

const random = (): number => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return (a[0] as number) / 2 ** 32;
};

const pick = (set: string, rand: () => number) => set[Math.floor(rand() * set.length)] ?? "";

const NO_POLICY: Policy = {
  endLiteral: null,
  excludeChars: null,
  id: "",
  isDefault: false,
  maxLength: null,
  minLength: 20,
  name: "",
  requireDigit: true,
  requireLower: true,
  requireSymbol: true,
  requireUpper: true,
  startClass: "letter",
};

/**
 * A fresh password made to `policy` (or a long mixed one when there's none), with the
 * browser's or server's crypto random source.
 */
export const generatePassword = (policy?: Policy, rand = random): string => {
  const p = policy ?? NO_POLICY;
  const exclude = p.excludeChars ?? "";
  const pool = (set: string) => [...set].filter((c) => !exclude.includes(c)).join("");
  const sets = {
    digit: pool(SETS.digit),
    lower: pool(SETS.lower),
    symbol: pool(SETS.symbol),
    upper: pool(SETS.upper),
  };
  const any = [
    p.requireUpper || !p.requireDigit ? sets.upper : "",
    p.requireLower || !p.requireDigit ? sets.lower : "",
    sets.digit,
    p.requireSymbol ? sets.symbol : "",
  ].join("");
  const end = p.endLiteral ?? "";
  const target = Math.max(p.minLength, Math.min(p.maxLength || 20, 20)) - end.length;
  const chars = [
    ...(p.requireUpper ? [pick(sets.upper, rand)] : []),
    ...(p.requireLower ? [pick(sets.lower, rand)] : []),
    ...(p.requireDigit ? [pick(sets.digit, rand)] : []),
    ...(p.requireSymbol ? [pick(sets.symbol, rand)] : []),
  ];
  while (chars.length < target) chars.push(pick(any, rand));
  for (let index = chars.length - 1; index > 0; index--) {
    const index_ = Math.floor(rand() * (index + 1));
    [chars[index], chars[index_]] = [chars[index_] as string, chars[index] as string];
  }
  const startSet = {
    any: "",
    digit: sets.digit,
    letter: sets.lower + sets.upper,
    symbol: sets.symbol,
  }[p.startClass ?? "any"];
  if (startSet && !startSet.includes(chars[0] as string)) {
    const swap = chars.findIndex((c) => startSet.includes(c));
    if (swap > 0) [chars[0], chars[swap]] = [chars[swap] as string, chars[0] as string];
    else chars[0] = pick(startSet, rand);
  }
  return chars.join("") + end;
};
