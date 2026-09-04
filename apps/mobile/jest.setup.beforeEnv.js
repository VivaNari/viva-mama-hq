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

// Firebase Analytics mock.
//
// src/analytics/client.ts calls getAnalytics() at module scope, so without this
// every suite that renders anything importing from src/analytics — which after
// instrumentation is most of the app — dies on import rather than failing a
// meaningful assertion.
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  setUserProperties: jest.fn(() => Promise.resolve()),
  setAnalyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
}));

// Firebase Crashlytics mock. Same reasoning as analytics above — getCrashlytics()
// runs at import time, and its real constructor installs global error handlers.
jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  getCrashlytics: jest.fn(() => ({})),
  log: jest.fn(),
  recordError: jest.fn(),
  setAttribute: jest.fn(() => Promise.resolve()),
  setAttributes: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
  crash: jest.fn(),
  setCrashlyticsCollectionEnabled: jest.fn(() => Promise.resolve()),
}));
