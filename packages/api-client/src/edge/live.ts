import type { Edge } from "#api/edge/types";

/** The live edge: requests go to the gateway that serves the app. Nothing to start. */
export const edge: Edge = {
  banner: null,
  mode: "live",
  start: async () => {},
  storagePrefix: "",
};
