/**
 * __tests__/more_component_snapshots_and_decode_extra.test.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GradientButtonWithSlightRadius from '../src/components/GradientButtonWithSlightRadius';
import { decodeToken } from '../src/utils/decodeJWTToken';
import * as jwt from 'jwt-decode';
import MessageWithLinks from '../src/components/MessageWithLinks';
import { Linking } from 'react-native';

// Snapshot tests for button variations
describe('GradientButton snapshots', () => {
  test('default rounded snapshot', () => {
    const onPress = jest.fn();
    const tree = render(<GradientButtonWithSlightRadius title="Ok" onPress={onPress} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  test('fullRounded snapshot', () => {
    const onPress = jest.fn();
    const tree = render(<GradientButtonWithSlightRadius title="Round" onPress={onPress} fullRounded />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});

// Additional MessageWithLinks test (no url scenario was in Batch 1; add one more case)
describe('MessageWithLinks additional checks', () => {
  test('multiple urls render each separately and open when pressed', () => {
    const msg = 'First https://one.com and then https://two.com';
    const { getByText } = render(<MessageWithLinks text={msg} />);
    const first = getByText('https://one.com');
    const second = getByText('https://two.com');
    fireEvent.press(first);
    fireEvent.press(second);
    expect(Linking.openURL).toHaveBeenCalledWith('https://one.com');
    expect(Linking.openURL).toHaveBeenCalledWith('https://two.com');
  });
});

// Extra decodeToken edge-case already handled in Batch 1, but include another explicit unit:
describe('decodeToken edge-case test', () => {
  test('returns null for empty string token', () => {
    jest.spyOn(jwt as any, 'jwtDecode').mockImplementation(() => { throw new Error('empty'); });
    expect(decodeToken('')).toBeNull();
  });
});
