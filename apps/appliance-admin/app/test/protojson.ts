/**
 * An answer the way connect-go's protojson codec sends it: empty lists, "", 0, false and an
 * enum's zero value (`*_UNSPECIFIED`) are left out of the JSON, at every depth.
 */
export const asProtojson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => asProtojson(item));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const sent = asProtojson(field);
    if (!isZero(sent)) out[key] = sent;
  }
  return out;
};

const isZero = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  value === 0 ||
  value === false ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "string" && value.endsWith("_UNSPECIFIED"));

/**
 * Empties every list nested inside at least `depth` lists: 0 empties every list, 1 keeps the
 * top-level lists' items but empties the lists inside them (an admin with no keys).
 */
export const emptyLists = (value: unknown, depth: number): unknown => {
  if (Array.isArray(value)) {
    if (depth <= 0) return [];
    return value.map((item) => emptyLists(item, depth - 1));
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, emptyLists(field, depth)]),
  );
};
