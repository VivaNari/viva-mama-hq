// eslint.config.cjs

const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettierPlugin = require("eslint-plugin-prettier");
const importPlugin = require("eslint-plugin-import");
const path = require("path");
const tsResolver = require("eslint-import-resolver-typescript");

module.exports = [
    {
        files: ["**/*.ts", "**/*.js"],

        ignores: ["dist", "node_modules", "load-tests/**"],

        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.eslint.json",
                tsconfigRootDir: __dirname,
            },
        },

        plugins: {
            "@typescript-eslint": tseslint,
            import: importPlugin,
            prettier: prettierPlugin,
        },

        settings: {
            "import/resolver": {
                typescript: {
                    project: path.resolve(__dirname, "./tsconfig.json"),
                },
            },
        },

        rules: {
            ...tseslint.configs.recommended.rules,
            ...importPlugin.configs.recommended.rules,

            "prettier/prettier": "error",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "import/prefer-default-export": "off",
            "class-methods-use-this": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
];
