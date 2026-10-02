import { jsonProblem } from "@/lib/json";

describe("jsonProblem", () => {
  it("is null for valid JSON", () => {
    expect(jsonProblem('{"name": "Acme"}')).toBeNull();
  });

  it("names the line of a truncated pack", () => {
    expect(jsonProblem('{\n  "vendor": "Acme",\n  "types": [')).toBe(
      "Invalid JSON at line 3: unexpected end of input.",
    );
  });

  it("names the line of a stray character", () => {
    expect(jsonProblem('{\n  "a": 1,\n  x\n}')).toMatch(/^Invalid JSON at line 3: /);
  });
});
