module.exports = {
  preset: 'react-native',

  // Runs BEFORE anything else → critical for mocks like AsyncStorage & Firebase
  setupFiles: [
    '<rootDir>/jest.setup.beforeEnv.js',
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
  },

  // Transpile ESM packages inside node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      'react-native|' +
      '@react-native-community|' +
      '@react-navigation|' +
      'react-native-linear-gradient|' +
      '@react-native-google-signin/google-signin|' +
      'react-native-toast-message|' +
      '@react-native-firebase/app|' +
      '@react-native-firebase/messaging' +
    ')/)',
  ],
};
