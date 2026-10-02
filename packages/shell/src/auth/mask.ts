/** Group a base32 key in fours for reading aloud or typing: "JBSW Y3DP EHPK 3PXP". */
export const groupKey = (key: string): string => {
  return key
    .replaceAll(/\s+/g, "")
    .replaceAll(/(.{4})/g, "$1 ")
    .trim();
};

/** "alice@example.org" -> "a••••@example.org". Null when the text isn't an email address. */
export const maskEmail = (value: string): null | string => {
  const v = value.trim();
  const at = v.indexOf("@");
  if (at < 1 || at === v.length - 1) return null;
  return `${v.charAt(0)}••••${v.slice(at)}`;
};
