/**
 * A string that exists only in this package. The production build check fails if it
 * finds it in a live bundle, which proves no mock code shipped.
 */
export const MOCK_MARKER = "sneakers-mock-gateway:not-for-production";
