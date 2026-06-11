// Root ESLint flat config — shared baseline for the Node/TypeScript code
// (services/backend and packages/*).
//
// The React Native app (apps/mobile) keeps its framework-standard preset
// (@react-native/eslint-config, eslintrc-style) as a necessary per-package
// override; the Python service (services/chatbot) is linted by Ruff. Both are
// ignored here. See CONTRIBUTING.md for the rationale.
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/lib/**',
      '**/coverage/**',
      '**/.turbo/**',
      'apps/mobile/**', // React Native app self-lints (see apps/mobile/.eslintrc.js)
      'services/chatbot/**', // Python — linted by Ruff
      'services/backend/load-tests/**', // k6 scripts (non-standard globals)
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    // Pragmatic baseline for the inherited backend code: catch real problems,
    // surface stylistic/unused issues as warnings rather than blocking. Full
    // strictness is a tracked follow-up (see MIGRATION_NOTES.md). Formatting is
    // owned by Prettier (`pnpm format`), not ESLint.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'prefer-const': 'warn',
      'no-console': 'off',
    },
  },
  prettier,
);
