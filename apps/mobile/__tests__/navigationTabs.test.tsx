import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DashboardTabs } from '../src/navigators/tabs/DashboardTabs';
import ArticleContent from '../src/screens/ArticleContent';
import Library from '../src/screens/Library';
import { useCapability } from '../src/context/SubscriptionContext';
import enLocale from '../src/i18n/locales/en.json';
import hiLocale from '../src/i18n/locales/hi.json';

const mockGetContents = jest.fn();
const mockGet = jest.fn();
const mockScreens: { name: string; title?: string }[] = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../src/context/SubscriptionContext', () => ({ useCapability: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ userId: 'u1' }) }));
jest.mock('../src/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('../src/api/getUserContents', () => ({
  getUserContents: (...args: unknown[]) => mockGetContents(...args),
}));
jest.mock('../src/api/apiClientInterceptor', () => ({
  __esModule: true,
  default: () => ({ get: mockGet }),
}));
jest.mock('../src/hooks/useScreenEdges', () => ({ useScreenEdges: () => ['left', 'right'] }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
// Records what the tab bar is given, in order, without needing a real navigator.
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ name, options }: any) => {
      mockScreens.push({ name, title: options?.title });
      return null;
    },
  }),
}));
jest.mock('../src/screens/Dashboard', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/Experts', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/VivaAIHub', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/VivaClubPost', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/Products', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>products-screen</Text> };
});
jest.mock('../src/components/ArticleCard', () => ({ ArticleCard: () => null }));
jest.mock('../src/components/SearchInput', () => ({ __esModule: true, default: () => null }));

const setProductsLocked = (locked: boolean) =>
  (useCapability as jest.Mock).mockReturnValue({ locked });

beforeEach(() => {
  mockScreens.length = 0;
  mockGet.mockReset();
  mockGetContents.mockReset().mockResolvedValue({ data: [] });
  setProductsLocked(false);
});

describe('bottom tabs', () => {
  it('shows Journey, Viva AI, Experts, Community and Library, in that order', () => {
    render(<DashboardTabs />);

    expect(mockScreens.map(screen => screen.title)).toEqual([
      'nav.tabJourney',
      'nav.tabVivaAi',
      'nav.tabExperts',
      'nav.tabCommunity',
      'nav.tabLibrary',
    ]);
  });

  it('has no Products tab, and keeps the Dashboard route under the Journey label', () => {
    render(<DashboardTabs />);

    const names = mockScreens.map(screen => screen.name);
    expect(names).not.toContain('Products');
    expect(names).toContain('Dashboard');
  });

  it('does not take the plan catalog route name', () => {
    render(<DashboardTabs />);

    expect(mockScreens.map(screen => screen.name)).not.toContain('Services');
  });

  it.each([
    ['en', enLocale],
    ['hi', hiLocale],
  ])('has %s labels for every tab', (_lang, locale: any) => {
    expect(locale.nav.tabJourney).toBeTruthy();
    expect(locale.nav.tabLibrary).toBeTruthy();
    expect(locale.nav.tabCommunity).toBeTruthy();
    expect(locale.content.libraryArticles).toBeTruthy();
  });
});

describe('Library', () => {
  it('starts on articles, and opens products only when selected', async () => {
    const { getByText, queryByText } = render(<Library />);

    expect(getByText('content.libraryArticles')).toBeTruthy();
    expect(queryByText('products-screen')).toBeNull();

    fireEvent.press(getByText('nav.tabProducts'));

    expect(getByText('products-screen')).toBeTruthy();
    await waitFor(() => expect(mockGetContents).toHaveBeenCalled());
  });

  it('hides the toggle and products when products are locked', async () => {
    setProductsLocked(true);
    const { queryByText } = render(<Library />);

    expect(queryByText('nav.tabProducts')).toBeNull();
    expect(queryByText('content.libraryArticles')).toBeNull();
    expect(queryByText('products-screen')).toBeNull();
    await waitFor(() => expect(mockGetContents).toHaveBeenCalled());
  });
});

describe('ArticleContent', () => {
  it('no longer loads community posts', async () => {
    render(<ArticleContent />);

    await waitFor(() => expect(mockGetContents).toHaveBeenCalled());
    expect(mockGet).not.toHaveBeenCalled();
  });
});
