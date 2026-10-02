/** Where a pasted JSON document goes wrong, as "Invalid JSON at line 3: …", or null when it parses. */
export const jsonProblem = (source: string): null | string => {
  try {
    JSON.parse(source);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const at = /position (\d+)/.exec(message)?.[1];
    const offset = at === undefined ? source.length : Number(at);
    const line = source.slice(0, offset).split("\n").length;
    const what = /unexpected end/i.test(message)
      ? "unexpected end of input"
      : (
          /^(?:[^:]*: )?(.*?)(?: in JSON)? at position/i.exec(message)?.[1] ?? "it doesn't parse"
        ).replace(/^./, (c) => c.toLowerCase());
    return `Invalid JSON at line ${line}: ${what}.`;
  }
};
