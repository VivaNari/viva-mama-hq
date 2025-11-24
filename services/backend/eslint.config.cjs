const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettierPlugin = require("eslint-plugin-prettier");
const importPlugin = require("eslint-plugin-import");
const path = require("path");

module.exports = [
    {
        // Which files to lint
        files: ["**/*.ts", "**/*.js"],

        // What to ignore
        ignores: ["dist", "node_modules"],

        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.eslint.json", // IMPORTANT
                tsconfigRootDir: __dirname,
            },
        },

        plugins: {
            "@typescript-eslint": tseslint,
            import: importPlugin,
            prettier: prettierPlugin,
        },

        rules: {
            // Typescript recommended overrides
            ...tseslint.configs.recommended.rules,

            // Import plugin recommended behavior
            ...importPlugin.configs.recommended.rules,

            // Enforce Prettier formatting
            "prettier/prettier": "error",

            // Helpful Node/TS backend rules
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "import/prefer-default-export": "off",
            "class-methods-use-this": "off",
        },
    },
];
