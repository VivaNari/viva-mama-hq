/* eslint-disable import/no-commonjs */
module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.eslint.json"], // separate faster config for ESLint
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "prettier"],
  extends: [
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended", // enables eslint-plugin-prettier + shows Prettier issues as ESLint errors
  ],
  settings: {
    "import/resolver": {
      typescript: { project: "./tsconfig.json" }, // resolve TS paths/aliases
    },
  },
  rules: {
    // Keep Prettier as the single source of formatting truth
    "prettier/prettier": "error",

    // Common Node/TS tweaks (tune as you like)
    "import/prefer-default-export": "off",
    "class-methods-use-this": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
