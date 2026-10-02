import { createESLintConfig } from "@the-rabbit-hole/eslint-config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-mock/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/src/generated/**",
      ".schemas/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...createESLintConfig({ enable: ["eslintA11y", "eslintTesting"] }),
  // The shared config ignores every folder named lib or docs; ours hold source.
  { ignores: ["!**/src/lib", "!**/src/lib/**", "!docs", "!docs/**"] },
  // eslint-plugin-react can't detect the version under ESLint 10, so name it.
  { settings: { react: { version: "19.3" } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
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
];
