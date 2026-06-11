// Must be mocked BEFORE RN modules are imported
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Firebase App mock (prevents native crashes)
jest.mock('@react-native-firebase/app', () => {
  const firebaseApp = {
    initializeApp: jest.fn(),
    app: jest.fn(() => ({
      messaging: jest.fn(() => ({
        getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
      })),
    })),
    apps: [],
  };

  return {
    __esModule: true,
    default: firebaseApp,
    firebase: firebaseApp,
  };
});

// Firebase Messaging mock (prevents RNFBAppModule errors)
jest.mock('@react-native-firebase/messaging', () => {
  return () => ({
    hasPermission: jest.fn(() => Promise.resolve(true)),
    requestPermission: jest.fn(() => Promise.resolve(true)),
    getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
    onMessage: jest.fn(),
    setBackgroundMessageHandler: jest.fn(),
  });
});
