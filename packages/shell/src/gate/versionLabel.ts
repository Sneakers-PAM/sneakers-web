/** The version as the sign-in page shows it: one "v" in front, whether or not it had one. */
export const versionLabel = (version: string): string => {
  const bare = version.trim().replace(/^v\s*/i, "");
  return bare ? `v${bare}` : "";
};
