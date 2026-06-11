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
