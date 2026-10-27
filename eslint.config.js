// ESLint rules used by cli-code-analyzer; declare Thunderbird APIs as globals.
export default [
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: "readonly",
        console: "readonly",
        messenger: "readonly",
        document: "readonly",
        DOMParser: "readonly",
        getComputedStyle: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        atob: "readonly",
        navigator: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-undef": "error",
    },
  },
  {
    files: ["tools/**/*.js", "tools/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
  },
];
