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
// Reanimated mock
// -----------------------------
// Hand-written rather than `react-native-reanimated/mock`. Reanimated 4 routes through
// react-native-worklets, and its shipped mock still trips the native initialisation check
// ("Native part of Worklets doesn't seem to be initialized") under Jest.
//
// This mock is also the more useful one: `useAnimatedStyle` actually RUNS the worklet and
// returns its result, so a milestone scene renders the real styles for whatever moment the
// clock is sitting at. A mock that returned {} would let a scene with broken arithmetic
// pass every test.
//
// Only the surface the app imports is covered — Animated, Easing, cancelAnimation,
// useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView, Image } = require('react-native');

  const passthrough = (value) => value;

  const createAnimatedComponent = (Component) =>
    React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));

  const Animated = createAnimatedComponent(View);
  Animated.View = createAnimatedComponent(View);
  Animated.Text = createAnimatedComponent(Text);
  Animated.ScrollView = createAnimatedComponent(ScrollView);
  Animated.Image = createAnimatedComponent(Image);
  Animated.createAnimatedComponent = createAnimatedComponent;
  // Called by @gorhom/bottom-sheet at import time. Reanimated 4 dropped it, so the real
  // module does not have it either — any screen that opens a sheet would otherwise take
  // its whole suite down on the import alone, before a single test ran.
  Animated.addWhitelistedUIProps = () => undefined;
  Animated.addWhitelistedNativeProps = () => undefined;

  return {
    __esModule: true,
    default: Animated,
    // The clock never advances under test; a scene renders the frame at whatever its
    // shared value currently holds, which is what makes assertions deterministic.
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (worklet) => {
      try {
        return worklet() || {};
      } catch (error) {
        return {};
      }
    },
    useAnimatedProps: (worklet) => {
      try {
        return worklet() || {};
      } catch (error) {
        return {};
      }
    },
    useReducedMotion: () => false,
    useDerivedValue: (worklet) => ({ value: worklet() }),
    withTiming: passthrough,
    withSpring: passthrough,
    withDelay: (_delay, value) => value,
    withRepeat: passthrough,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: () => undefined,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: {
      linear: passthrough,
      ease: passthrough,
      quad: passthrough,
      cubic: passthrough,
      bezier: () => passthrough,
      in: passthrough,
      out: passthrough,
      inOut: passthrough,
    },
  };
});

// -----------------------------
// Video player mock (native-only)
// -----------------------------
jest.mock('react-native-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const seek = jest.fn();
  const Video = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ seek }));
    return React.createElement(View, { ...props, testID: 'journey-video-player' });
  });
  return { __esModule: true, default: Video, seek };
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
// Chat attachment pickers (native-only)
// -----------------------------
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn().mockRejectedValue(Object.assign(new Error('cancel'), { code: 'OPERATION_CANCELED' })),
  keepLocalCopy: jest.fn().mockResolvedValue([]),
  isErrorWithCode: (e) => !!e && typeof e.code === 'string',
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  types: { pdf: 'application/pdf' },
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

// -----------------------------
// Voice (native-only): expo-speech reads replies aloud, expo-speech-recognition types
// what she says. Recognition events are captured per name so a test can fire them with
// `require('expo-speech-recognition').__emit('result', {...})`.
// -----------------------------
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
  maxSpeechInputLength: 4000,
}));

jest.mock('expo-speech-recognition', () => {
  const listeners = {};
  return {
    ExpoSpeechRecognitionModule: {
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
      isRecognitionAvailable: jest.fn(() => true),
      requestPermissionsAsync: jest.fn(() =>
        Promise.resolve({ granted: true, canAskAgain: true, status: 'granted', expires: 'never' }),
      ),
      getSpeechRecognitionServices: jest.fn(() => []),
    },
    useSpeechRecognitionEvent: (name, handler) => {
      listeners[name] = handler;
    },
    __emit: (name, event) => listeners[name] && listeners[name](event),
  };
});
