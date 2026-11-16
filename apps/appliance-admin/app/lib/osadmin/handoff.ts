/**
 * The host name step moves the page to the box's new name, which is a different origin, so the
 * session can't come along. SetupService.SetHostname answers with a one-time handoff code; the
 * page opens the new name with the code in the fragment (never sent in a request line or a
 * Referer) and SignInService.RedeemHandoff swaps it for a session there.
 */
const PREFIX = "#handoff=";

/** The handoff code in a location hash, if it carries one. */
export const handoffCodeFrom = (hash: string): string | undefined => {
  if (!hash.startsWith(PREFIX)) return undefined;
  return decodeURIComponent(hash.slice(PREFIX.length)) || undefined;
};

/** A full page load of the new name: the browser asks about its new certificate once. */
export const goToNewName = (url: string): void => {
  globalThis.location.assign(url);
};
