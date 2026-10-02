import { createESLintConfig } from "@the-rabbit-hole/eslint-config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const shared = createESLintConfig({ enable: ["eslintA11y", "eslintTesting"] });

// Testing Library's rules read Playwright's page.getByRole as a render result; the e2e specs
// aren't Testing Library tests, so none of its rules apply there.
const testingLibraryOff = Object.fromEntries(
  shared
    .flatMap((block) => Object.keys(block.rules ?? {}))
    .filter((rule) => rule.startsWith("testing-library/"))
    .map((rule) => [rule, "off"]),
);

export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-mock/**",
      "**/build/**",
      "**/build-mock/**",
      "**/.react-router/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/src/generated/**",
      ".schemas/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...shared,
  // The shared config ignores every folder named lib or docs; ours hold source.
  { ignores: ["!**/src/lib", "!**/src/lib/**", "!docs", "!docs/**"] },
  // eslint-plugin-react can't detect the version under ESLint 10, so name it.
  { settings: { react: { version: "19.3" } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Route modules export loaders and actions beside the page, and the packages export hooks
      // and helpers beside components; React Router's own HMR handles both.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    rules: {
      // Components and their files are PascalCase (the repo layout), modules camelCase, and the
      // workspace folders kebab-case like their package names.
      "unicorn/filename-case": [
        "error",
        { cases: { camelCase: true, kebabCase: true, pascalCase: true } },
      ],
      // Prettier strips the parentheses this rule asks for, so the two can never both pass.
      "unicorn/no-nested-ternary": "off",
      // GraphQL models a missing value as null, and the generated types say so.
      "unicorn/no-null": "off",
      // Names React, Vite and the DOM use as-is.
      "unicorn/prevent-abbreviations": [
        "error",
        {
          allowList: {
            env: true,
            ImportMetaEnv: true,
            Props: true,
            props: true,
            ref: true,
            Ref: true,
          },
        },
      ],
    },
  },
  { files: ["e2e/**/*.ts"], rules: testingLibraryOff },
];
