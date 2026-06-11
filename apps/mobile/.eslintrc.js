module.exports = {
  root: true,
  extends: '@react-native',
  env: {
    jest: true,
  },
  rules: {
    "react-native/no-inline-styles": "off",
    "react/no-unstable-nested-components": "off",
    // Pragmatic baseline for the inherited app: surface these as warnings rather
    // than blocking errors. Cleanup is tracked in MIGRATION_NOTES.md.
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/rules-of-hooks": "warn"
  }
};
