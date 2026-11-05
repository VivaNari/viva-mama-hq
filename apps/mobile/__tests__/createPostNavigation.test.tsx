import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import CreatePost from '../src/screens/CreatePost';

const mockNavigate = jest.fn();
const mockPost = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: any) => <View>{children}</View> };
});
jest.mock('../src/context/SubscriptionContext', () => ({
  useCapability: () => ({ maxChars: 250, unlimited: false }),
  useSubscriptionContext: () => ({ openPaywall: jest.fn() }),
}));
jest.mock('../src/api/vivaClubModeration', () => ({
  getGuidelinesStatus: jest.fn(async () => ({ accepted: true })),
}));
jest.mock('../src/api/apiClientInterceptor', () => ({
  __esModule: true,
  default: () => ({ post: mockPost }),
}));
jest.mock('../src/components/vivaClub/CommunityGuidelinesGate', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock('../src/analytics', () => ({
  AnalyticsEvent: {},
  recordError: jest.fn(),
  track: jest.fn(),
}));

describe('CreatePost', () => {
  it('lands on the Community tab after publishing', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { getByText, UNSAFE_getByType } = render(<CreatePost />);

    fireEvent.changeText(UNSAFE_getByType(TextInput), 'Hello mothers');
    fireEvent.press(getByText('vivaClub.post'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('DashboardTabNavigator', { screen: 'Community' }),
    );
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
