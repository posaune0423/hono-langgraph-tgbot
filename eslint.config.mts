import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Base JavaScript config
  js.configs.recommended,
  // TypeScript configs (only recommended, not type-checked for test files)
  ...tseslint.configs.recommended,
  // Base config for source files (with type checking)
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "scripts/**/*.{js,mjs,cjs,ts,mts,cts}"],
    ...tseslint.configs.recommendedTypeChecked[0],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Code quality rules
      "prefer-const": "error",
      "no-var": "error",
      // Prettier integration
      "prettier/prettier": [
        "error",
        {
          experimentalTernaries: true,
        },
      ],
    },
  },
  // Special config for files that need require() or @ts-nocheck
  {
    files: ["src/lib/privy.ts", "src/bot/commands/long/helper.ts", "src/bot/commands/short/helper.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Test files config (without type checking since tests are excluded from tsconfig)
  {
    files: ["tests/**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript specific rules (without type checking)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Code quality rules
      "prefer-const": "error",
      "no-var": "error",
      // Prettier integration
      "prettier/prettier": [
        "error",
        {
          experimentalTernaries: true,
        },
      ],
      // Disable type-aware rules for test files
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/await-thenable": "off",
      // Allow @ts-nocheck and require() in test files
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Prettier config (must be last to override other configs)
  prettier,
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".wrangler/**",
      "docs/**",
      ".cursor/**",
      ".kiro/**",
      "*.lock",
      ".env*",
      ".dev.vars*",
      "*.log",
      ".DS_Store",
      "worker-startup.cpuprofile",
      ".serena/**",
      "migrations/**",
      "src/types/worker-configuration.d.ts",
      "src/lib/quicknode/filter.js",
      "**/*.json",
      "**/*.jsonc",
      "**/*.json5",
      "**/*.md",
    ],
  },
]);
