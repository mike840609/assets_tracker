import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored agent skills — not part of the app source.
    ".agents/**",
  ]),
  // Disallow raw console calls — use src/lib/logger.ts instead (server) or eslint-disable for client components
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-console": "warn",
    },
  },
  // Allow _-prefixed variables to be unused (standard convention for intentionally unused bindings)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Disable ESLint rules that conflict with Prettier; must be last.
  prettier,
]);

export default eslintConfig;
