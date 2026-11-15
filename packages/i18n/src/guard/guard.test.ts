// @vitest-environment node
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

import { scanLiteralProps } from "./scanLiterals";

const root = path.resolve(import.meta.dirname, "../../../..");

/** The files already moved to catalogues: the ones `.oxlintrc.json` holds to `react/jsx-no-literals`. */
const migrated = (): string[] => {
  const config = JSON.parse(readFileSync(path.join(root, ".oxlintrc.json"), "utf8")) as {
    overrides: { files: string[]; rules: Record<string, string> }[];
  };
  return config.overrides
    .filter((o) => o.rules["react/jsx-no-literals"] === "error")
    .flatMap((o) => o.files)
    .flatMap((pattern) => globSync(pattern, { cwd: root }));
};

describe("the string scanner", () => {
  it("finds a user-facing prop given a literal, in either JSX form", () => {
    const found = scanLiteralProps(
      `const a = <Field hint="Comma-separated" label={"Name"} aria-label={t("x")} className="p-4" />;`,
    );
    expect(found.map((f) => f.text)).toEqual(['hint="Comma-separated"', 'label={"Name"}']);
  });

  it("leaves messages, symbols and non-text props alone", () => {
    expect(
      scanLiteralProps(
        `const a = <Button title={t("save")} label="·" id="save-button" aria-label={label} />;`,
      ),
    ).toEqual([]);
  });
});

describe("a hard-coded user-facing string", () => {
  it("is not in any file already moved to a catalogue", () => {
    const files = migrated();
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      scanLiteralProps(readFileSync(path.join(root, file), "utf8"), file).map(
        (f) => `${file}:${String(f.line)} ${f.text}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
