// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

export default defineConfig(
  { ignores: ["dist/", "docs/", "node_modules/"] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat.recommended,

  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: "detect" } },
    rules: {
      // Conventions the codebase already follows
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "interface", format: ["PascalCase"], prefix: ["I"] },
      ],
      // `_`-prefixed names mark intentionally unused parameters (e.g. `_dt`)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Singletons use `private constructor() {}`
      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["private-constructors"] },
      ],
      // Async React event handlers catch their own errors
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      // IPoint declares toString() for debug text: `Position: ${point}`
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allow: [
            { from: "lib", name: ["Error", "URL", "URLSearchParams"] },
            { from: "file", name: "IPoint" },
          ],
        },
      ],

      // Deliberate deviations from the presets
      // Fields are annotated even when initialised: `private _lives: number = 0`
      "@typescript-eslint/no-inferrable-types": "off",
      // Factories are interfaces with a construct signature (IEnemyFactory etc.)
      "@typescript-eslint/prefer-function-type": "off",
      // Point2D's fluent methods return Point2D; it is not subclassed
      "@typescript-eslint/prefer-return-this-type": "off",
      // Diagnostics go to the console; there is no logger
      "no-console": "off",
    },
  },

  // Must stay last: turns off rules that conflict with Prettier
  prettier,
);
