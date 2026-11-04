import shared from "@bugs5382/node-oxlint-config/oxfmt";

export default {
  ...shared,
  ignorePatterns: [
    ...shared.ignorePatterns,
    "**/dist/**",
    "**/dist-mock/**",
    "**/build/**",
    "**/build-mock/**",
    "**/.react-router/**",
    "coverage/**",
    "package-lock.json",
  ],
  printWidth: 100,
};
