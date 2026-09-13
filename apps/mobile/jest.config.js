module.exports = {
  preset: 'react-native',

  // Runs BEFORE anything else → critical for mocks like AsyncStorage & Firebase
  setupFiles: [
    '<rootDir>/jest.setup.beforeEnv.js',
    // Ships with the library; registers the native module stubs the Gesture API needs.
    // The growth chart's touch read-out is built on Gesture.Pan/Tap.
    'react-native-gesture-handler/jestSetup',
  ],

  // Runs AFTER environment is set
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
  ],

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Binary assets are not JavaScript. Metro resolves them at build time, but Jest
  // tries to parse them and fails — @react-native-vector-icons/lucide imports its own
  // .ttf, so any component using an icon would take its whole suite down.
  moduleNameMapper: {
    '\\.(ttf|otf|woff|woff2|eot|png|jpg|jpeg|gif|webp|svg)$':
      '<rootDir>/__mocks__/fileMock.js',

    // Metro resolves this workspace package through the `react-native` export condition,
    // which points at TypeScript source. Jest resolves it through the symlink in
    // node_modules instead, where the allowlist below would refuse to transform it — so
    // point it at the source explicitly rather than depending on realpath behaviour.
    // This also means `npx jest` works without a prior `turbo build`.
    '^@vivamama/growth-standards$':
      '<rootDir>/../../packages/growth-standards/src/index.ts',
  },

  // Transpile ESM packages inside node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@vivamama|' +
      '@react-native|' +
      'react-native|' +
      '@react-native-community|' +
      '@react-navigation|' +
      'react-native-linear-gradient|' +
      'react-native-svg|' +
      'react-native-gesture-handler|' +
      '@react-native-google-signin/google-signin|' +
      'react-native-toast-message|' +
      '@react-native-firebase/app|' +
      '@react-native-firebase/messaging' +
    ')/)',
  ],
};
