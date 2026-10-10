/** The header the appliance's box-state page carries (sneakers-appliance `docs/edge-fallback.md`). */
export const BOX_STATE_HEADER = "Sneakers-Box-State";

/**
 * Watch every request this page makes: when one is answered by the appliance's box-state page
 * (the edge holds the product while the box starts or updates), call `held` once with the state.
 * The poller covers an open tab too; this catches it on the page's own next request, even where
 * the poller's timer is throttled. Returns a function that stops watching.
 */
export const watchBoxState = (held: (state: string) => void): (() => void) => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async (...parameters: Parameters<typeof fetch>) => {
    const response = await originalFetch(...parameters);
    const state = response.headers.get(BOX_STATE_HEADER);
    if (state && state !== "running" && !called) {
      called = true;
      held(state);
    }
    return response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
};
