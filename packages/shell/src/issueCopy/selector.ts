/**
 * The clicked element, named the way a test would find it: its nearest `data-testid`, or
 * otherwise a short CSS selector built from its tag, id and first class. Never its text
 * content.
 */
export const shortSelector = (element: Element): string => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const testId = "dataset" in node ? (node as HTMLElement).dataset.testid : undefined;
    if (testId) return `[data-testid=${testId}]`;
  }
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const firstClass = element.classList.item(0);
  const cls = firstClass ? `.${firstClass}` : "";
  return `${tag}${id}${cls}`;
};
