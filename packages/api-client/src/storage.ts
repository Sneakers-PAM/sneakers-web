import { edge } from "@sneakers-web/edge";

/**
 * The browser storage key for a setting. Mock builds prefix every key with "mock:", so a
 * mock session never reads or overwrites what a live session saved, and the other way round.
 */
export const storageKey = (name: string): string => {
  return `${edge.storagePrefix}sneakers.${name}`;
};
