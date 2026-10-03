const NATO: Record<string, string> = {
  a: "alpha",
  b: "bravo",
  c: "charlie",
  d: "delta",
  e: "echo",
  f: "foxtrot",
  g: "golf",
  h: "hotel",
  i: "india",
  j: "juliett",
  k: "kilo",
  l: "lima",
  m: "mike",
  n: "november",
  o: "oscar",
  p: "papa",
  q: "quebec",
  r: "romeo",
  s: "sierra",
  t: "tango",
  u: "uniform",
  v: "victor",
  w: "whiskey",
  x: "x-ray",
  y: "yankee",
  z: "zulu",
};

const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const SYMBOLS: Record<string, string> = {
  " ": "space",
  _: "underscore",
  "-": "dash",
  ",": "comma",
  ";": "semicolon",
  ":": "colon",
  "!": "exclamation",
  "?": "question",
  ".": "period",
  "'": "apostrophe",
  '"': "quote",
  "(": "open paren",
  ")": "close paren",
  "[": "open bracket",
  "]": "close bracket",
  "{": "open brace",
  "}": "close brace",
  "@": "at",
  "*": "asterisk",
  "/": "slash",
  "\\": "backslash",
  "&": "ampersand",
  "#": "hash",
  "%": "percent",
  "`": "backtick",
  "^": "caret",
  "+": "plus",
  "<": "less than",
  "=": "equals",
  ">": "greater than",
  "|": "pipe",
  "~": "tilde",
  $: "dollar",
};

export type PhoneticKind = "digit" | "lower" | "symbol" | "upper";

/** How the keypad reads one character: its word, and what kind of character it is. */
export const phoneticFor = (ch: string): { kind: PhoneticKind; word: string } => {
  const lower = ch.toLowerCase();
  const letter = NATO[lower];
  if (letter)
    return ch === lower
      ? { kind: "lower", word: letter }
      : { kind: "upper", word: `${letter} (cap)` };
  if (/^\d$/.test(ch)) return { kind: "digit", word: DIGITS[Number(ch)] ?? ch };
  return { kind: "symbol", word: SYMBOLS[ch] ?? ch };
};

/** The value as words for reading aloud, with capitals called out. */
export const natoWords = (value: string): string =>
  [...value]
    .map((ch) => {
      const { kind, word } = phoneticFor(ch);
      return kind === "upper" ? `capital ${word.replace(" (cap)", "")}` : word;
    })
    .join(", ");

/** A super-sensitive value before its second reveal: the ends only, never short values. */
export const partialMask = (value: string): string => {
  const chars = [...value];
  if (chars.length <= 8) return "•".repeat(chars.length);
  return `${chars.slice(0, 4).join("")}${"•".repeat(chars.length - 8)}${chars.slice(-4).join("")}`;
};
