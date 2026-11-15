import ts from "typescript";

/** JSX props whose string is read by a person, so it belongs in a catalogue, not in the code. */
export const USER_FACING_PROPS = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "body",
  "description",
  "hint",
  "label",
  "loadingLabel",
  "placeholder",
  "subtitle",
  "title",
]);

export interface Finding {
  line: number;
  text: string;
}

/**
 * Hard-coded user-facing strings in JSX: a user-facing prop given a string literal. (Text between
 * tags is the `react/jsx-no-literals` lint rule's job; it can't see props.) A string with no letter
 * in it, such as "·" or "/", isn't text a person reads.
 */
export const scanLiteralProps = (source: string, fileName = "file.tsx"): Finding[] => {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: Finding[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && USER_FACING_PROPS.has(node.name.getText(file))) {
      const value = node.initializer;
      const literal =
        value && ts.isStringLiteral(value)
          ? value.text
          : value &&
              ts.isJsxExpression(value) &&
              value.expression &&
              (ts.isStringLiteral(value.expression) ||
                ts.isNoSubstitutionTemplateLiteral(value.expression))
            ? value.expression.text
            : undefined;
      if (literal !== undefined && /\p{L}/u.test(literal)) {
        found.push({
          line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          text: node.getText(file),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};
