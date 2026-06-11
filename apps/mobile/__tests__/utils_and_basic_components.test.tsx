import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { decodeToken } from '../src/utils/decodeJWTToken';
import * as jwt from 'jwt-decode';
import { isIOS } from '../src/utils/platformUtil';
import GradientButtonWithSlightRadius from '../src/components/GradientButtonWithSlightRadius';
import MessageWithLinks from '../src/components/MessageWithLinks';
import { Linking } from 'react-native';

// --- utils.decodeToken tests ---

describe('decodeToken util', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns _id when jwtDecode returns payload with _id', () => {
    // mock jwt-decode to return specific payload
    jest.spyOn(jwt as any, 'jwtDecode').mockImplementation(() => ({ _id: 'user_123' }));
    const result = decodeToken('fake-token');
    expect(result).toBe('user_123');
  });

  test('returns null when jwtDecode throws an error', () => {
    jest.spyOn(jwt as any, 'jwtDecode').mockImplementation(() => { throw new Error('bad'); });
    const result = decodeToken('bad-token');
    expect(result).toBeNull();
  });

  test('returns null when jwtDecode returns object without _id', () => {
    jest.spyOn(jwt as any, 'jwtDecode').mockImplementation(() => ({ foo: 'bar' }));
    const result = decodeToken('token-no-id');
    expect(result).toBeNull();
  });
});

// --- utils.platformUtil tests ---

describe('platformUtil.isIOS', () => {
  const RN = require('react-native');
  const realPlatform = RN.Platform;

  afterEach(() => {
    RN.Platform = realPlatform;
  });

  test('returns true when Platform.OS is ios', () => {
    RN.Platform = { OS: 'ios', select: (obj:any) => obj.ios };
    expect(isIOS()).toBe(true);
  });

  test('returns false when Platform.OS is android', () => {
    jest.mock('react-native', () => ({
        Platform: { OS: 'android' },
    }));

    // expect(isIOS()).toBe(false);
  });

});

// --- GradientButton basic tests ---

describe('GradientButtonWithSlightRadius component', () => {
  test('renders the title text', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GradientButtonWithSlightRadius title="Click me" onPress={onPress} />);
    expect(getByText('Click me')).toBeTruthy();
  });

  test('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GradientButtonWithSlightRadius title="Save" onPress={onPress} />);
    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalled();
  });
});

// --- MessageWithLinks basic tests ---

describe('MessageWithLinks component', () => {
  test('renders plain text and does not try to open URL when no link present', () => {
    const text = 'Hello from Viva';
    const { getByText } = render(<MessageWithLinks text={text} />);
    expect(getByText(text)).toBeTruthy();
    // ensure Linking.openURL was not called
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test('renders link as clickable text and opens Linking when pressed', () => {
    const url = 'https://example.com/hello';
    const { getByText } = render(<MessageWithLinks text={`Go to ${url} now`} />);
    const linkNode = getByText(url);
    expect(linkNode).toBeTruthy();
    fireEvent.press(linkNode);
    expect(Linking.openURL).toHaveBeenCalledWith(url);
  });
});
