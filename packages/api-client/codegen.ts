import type { CodegenConfig } from "@graphql-codegen/cli";

const schemas = "../../.schemas/gateway";

const scalars = { ID: "string" };

/**
 * Typed clients for the gateway's two GraphQL schemas. The human schema gets typed
 * documents for every operation in src/operations; the machine schema (used by agents,
 * scripts and service accounts) gets its types, for pages that explain or build calls to it.
 */
const config: CodegenConfig = {
  generates: {
    "src/generated/": {
      config: {
        avoidOptionals: { field: true, inputValue: false, object: false },
        documentMode: "string",
        enumsAsTypes: true,
        scalars,
        skipTypename: true,
        useTypeImports: true,
      },
      documents: ["src/operations/**/*.graphql"],
      preset: "client",
      presetConfig: { fragmentMasking: false },
      schema: `${schemas}/schema.graphqls`,
    },
    "src/generated/machine.ts": {
      config: { enumsAsTypes: true, scalars, skipTypename: true, useTypeImports: true },
      plugins: ["typescript"],
      schema: `${schemas}/machine.graphqls`,
    },
  },
  hooks: {},
  overwrite: true,
};

export default config;
