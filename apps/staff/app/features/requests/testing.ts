/**
 * Make useBreakpoint() report a desktop for the tests in this block. jsdom has no layout, so
 * the shared stub answers every media query with false, which reads as a phone.
 */
export const onDesktop = (): void => {
  let original: typeof globalThis.matchMedia;
  beforeEach(() => {
    original = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes("min-width"),
    })) as typeof globalThis.matchMedia;
  });
  afterEach(() => {
    globalThis.matchMedia = original;
  });
};
