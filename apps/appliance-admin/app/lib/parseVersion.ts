// A build version's parts, read out instead of shown as one long string: the build's own
// label, when it was built, the commit it was cut from, the release line it belongs to and its
// channel. Covers a dated lab build (Base OS, Base Web: 0.0.0-lab.20261009m2.r20261010031325-
// g79c3ceb), an undated one (0.0.0-lab.20261009k-g448530b), the product's own lab scheme
// (0.1.0-lab.sneakers.6), a release candidate (0.1.0-rc.1) and a stable release (0.1.0).
// Nothing here knows what a box is; it just reads a string.

export type VersionChannel = "lab" | "rc" | "stable";

export interface ParsedVersion {
  /** The build's own label: a lab build's letter (plus a number for a rebuild), an RC's
   * number as "rc1", or undefined for a stable release, which has no build beyond its line. */
  build?: string;
  channel: VersionChannel;
  /** The short commit hash a lab build was cut from, when the version names one. */
  commit?: string;
  /** When a dated lab build was made, as an ISO 8601 UTC instant. */
  builtAt?: string;
  /** The release line this build belongs to: the semver core, with "-lab" appended for a lab
   * build so a placeholder line (Base OS and Base Web both ship lab builds as "0.0.0") reads
   * as what it is. */
  line: string;
  /** The version exactly as given. */
  raw: string;
}

const CORE = /^\d+\.\d+\.\d+/;
const LAB_CHANNEL = /-lab\b/;
const RC = /-rc\.(\d+)\b/;
const COMMIT = /-g([0-9a-f]{6,})\b/;
const BUILT_AT = /\.r(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\b/;
/** An 8-digit date stamp immediately followed by the build's letter and, for a rebuild, a
 * number -- the one piece that's actually meant to be read, in every dated build. */
const DATED_BUILD = /\b\d{8}([a-z]\d*)\b/;
/** A lab build with no date stamp: the product's own scheme names its build after "-lab.". */
const LAB_LABEL = /-lab\.([a-zA-Z][\w.]*)/;

/**
 * A version's parts, or null when it doesn't even start with a semver core -- a caller falls
 * back to the raw string then, rather than guessing at a shape that isn't a version at all.
 */
export const parseVersion = (version: string): ParsedVersion | null => {
  const core = CORE.exec(version)?.[0];
  if (!core) return null;
  const channel: VersionChannel = LAB_CHANNEL.test(version)
    ? "lab"
    : RC.test(version)
      ? "rc"
      : "stable";
  const line = channel === "lab" ? `${core}-lab` : core;
  const commit = COMMIT.exec(version)?.[1];
  const built = BUILT_AT.exec(version);
  const builtAt = built
    ? `${built[1]}-${built[2]}-${built[3]}T${built[4]}:${built[5]}:${built[6]}Z`
    : undefined;
  const dated = DATED_BUILD.exec(version)?.[1];
  const rc = RC.exec(version)?.[1];
  const build =
    dated ?? (channel === "lab" ? LAB_LABEL.exec(version)?.[1] : undefined) ?? (rc ? `rc${rc}` : undefined);
  return { build, channel, commit, builtAt, line, raw: version };
};

/**
 * The short name a version goes by in a sentence or a button: the build's own label when
 * there is one, otherwise the release line (a stable release has nothing shorter than
 * "0.1.0"). Falls back to the raw string when it doesn't parse as a version at all.
 */
export const shortName = (version: string): string => {
  const parsed = parseVersion(version);
  return parsed ? parsed.build ?? parsed.line : version;
};
