// `npm run lint` was configured but no config file existed anywhere in the
// repo, so the command failed for every caller with "couldn't find a
// configuration file". The plugins it references are already devDependencies.
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "react-refresh"],
  ignorePatterns: [
    "dist",
    "backend/dist",
    "node_modules",
    "node_modules.nosync",
    "backend/node_modules",
    ".eslintrc.cjs",
  ],
  rules: {
    // The codebase logs deliberately in service and fetch paths.
    "no-console": "off",
    // Handlers legitimately take `any` from third-party payloads; the compiler
    // is the gate for real type problems, and it now runs over the frontend.
    "@typescript-eslint/no-explicit-any": "off",
    // Context defaults are intentionally no-ops until a provider supplies the
    // real implementation.
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};
