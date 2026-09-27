import { config as baseConfig } from "./base.js";
import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Must come after eslint-config-next (it downgrades this rule to warn). */
const unusedVarsRule = {
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};

/**
 * ESLint config for Next.js apps in the monorepo.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextAppConfig = [
  ...baseConfig,
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  unusedVarsRule,
];
