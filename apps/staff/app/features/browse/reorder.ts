/** Which way an arrow (or an arrow key on the drag handle) moves a secret. */
export type Direction = "down" | "up";

/** `ids` with `id` swapped with its neighbour; null at an end, or if `id` isn't in `ids`. */
export const movedBy = (ids: string[], id: string, direction: Direction): null | string[] => {
  const at = ids.indexOf(id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (at === -1 || to < 0 || to >= ids.length) return null;
  const out = [...ids];
  [out[at], out[to]] = [out[to] as string, out[at] as string];
  return out;
};

/**
 * `ids` with `id` dropped on the row `targetId`: it takes that row's place, so a secret dragged
 * down lands after it and one dragged up lands before it. Null when nothing would move.
 */
export const movedTo = (ids: string[], id: string, targetId: string): null | string[] => {
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return null;
  const out = ids.filter((x) => x !== id);
  out.splice(to, 0, id);
  return out;
};

/** What the live region reads after a move. */
export const moveNote = (name: string, ids: string[], id: string): string =>
  `${name} moved to position ${ids.indexOf(id) + 1} of ${ids.length}.`;
