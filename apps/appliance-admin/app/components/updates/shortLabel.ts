/**
 * A build version's short label for the Updates cards: the running and staged pills, the Apply,
 * Revert and Fetch buttons, and the offer list. A lab build's version runs long enough to break
 * a card's layout (sneakers-web Updates cards overflow); this reads any build's version the same
 * generic way, with nothing specific to the lab's own naming.
 */

/** An 8-digit date stamp immediately followed by the build's letter and, for a rebuild, a number. */
const BUILD_ID = /\d{8}([a-z]\d*)/;

/** The semver core and the first prerelease word, stopping at the next dot. */
const VERSION_HEAD = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+)?/;

/** The build id embedded in a version, e.g. "m1" from "...20261009m1...", or "" with none. */
export const buildId = (version: string): string => BUILD_ID.exec(version)?.[1] ?? "";

/**
 * The version shortened to its head and tail, joined by an ellipsis, when that's actually
 * shorter; otherwise the version unchanged. Generic: it has no idea what a "lab" build is, only
 * that a version starts with a semver core and often ends with a dash-separated commit-ish tail.
 */
export const shortVersion = (version: string): string => {
  const head = VERSION_HEAD.exec(version)?.[0] ?? version;
  const segments = version.split("-");
  const tail = segments.length > 1 ? segments.at(-1)! : "";
  if (!tail || head.length + 1 + tail.length >= version.length) return version;
  return `${head}…${tail}`;
};

/** The build id and the shortened version, joined, e.g. "m1 · 0.0.0-lab…g79c3ceb". */
export const shortLabel = (version: string): string => {
  const id = buildId(version);
  const short = shortVersion(version);
  return id ? `${id} · ${short}` : short;
};

/**
 * Text with its version swapped for the short label, so a sentence or a button keeps its words
 * but the long part shortens. Falls back to the text unchanged when the version isn't in it.
 */
export const withShortVersion = (text: string, version: string): string =>
  version ? text.replace(version, shortLabel(version)) : text;
