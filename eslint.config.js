// ESLint rules used by cli-code-analyzer; declare Thunderbird APIs as globals.
export default [
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: "readonly",
        messenger: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-undef": "error",
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
  },
];
