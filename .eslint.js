/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "plugin:playwright/playwright-test",
    "next",
    "plugin:prettier/recommended",
    "turbo",
    "plugin:@cspell/recommended",
  ],
  ignorePatterns: [
    "db",
    "out",
    "dist",
    "build",
    "cache",
    ".next",
    "public",
    ".turbo",
    ".vercel",
    "coverage",
    "generated",
    ".docusaurus",
    "node_modules",
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
    project: ["./apps/*/tsconfig.json", "./packages/*/tsconfig.json"],
  },
  rules: {
    // Add custom rules here
    "@next/next/no-html-link-for-pages": "off",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx", "*.cjs", "*.mjs", "*.js"],
      extends: ["plugin:@typescript-eslint/recommended"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",

      overrides: [
        {
          files: ["playwright/**/*.{tsx,ts}"],
          rules: {
            "no-undef": "off",
          },
        },
      ],
    },
  ],
};
