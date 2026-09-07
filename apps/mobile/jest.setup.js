import '@testing-library/jest-native/extend-expect';
import { Linking } from 'react-native';

// Initializes the real i18next instance with the app's actual en/hi resource
// bundles, so useTranslation() in tests resolves real copy instead of echoing
// raw keys (it has module-scope side effects — importing it is the init call).
import './src/i18n';

// -----------------------------
// LinearGradient mock
// -----------------------------
jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return ({ children, ...props }) => <View {...props}>{children}</View>;
});

// -----------------------------
// DateTimePicker mock
// -----------------------------
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return (props) => React.createElement('DateTimePickerMock', props);
});

// -----------------------------
// Vector Icons mock
// -----------------------------
jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const React = require('react');
  const MaterialDesignIcons = (props) => React.createElement('Icon', props);
  return {
    __esModule: true,
    default: MaterialDesignIcons,
    MaterialDesignIcons,
  };
});

// -----------------------------
// Toast Message mock
// -----------------------------
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}));

// -----------------------------
// Google Sign-In mock
// -----------------------------
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ idToken: 'fake-google-id' }),
    signOut: jest.fn().mockResolvedValue(),
    revokeAccess: jest.fn().mockResolvedValue(),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

// -----------------------------
// Linking mock
// -----------------------------
Linking.openURL = jest.fn();
