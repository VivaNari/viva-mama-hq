import React from 'react';
import { render } from '@testing-library/react-native';

import LogPicker from '../src/screens/logs/LogPicker';
import { useCareContext } from '../src/hooks/useCareContext';
import { CareModelEnum, UserCategoryEnum } from '../src/types/user.types';

jest.mock('../src/hooks/useCareContext', () => ({ useCareContext: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../src/components/logs/LogScreen', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ children }: any) => <View>{children}</View> };
});
jest.mock('../src/components/logs/OptionTile', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ label }: any) => <Text>{label}</Text> };
});

const withCare = (careModel: CareModelEnum | null) =>
  (useCareContext as jest.Mock).mockReturnValue({
    careModel,
    category: UserCategoryEnum.NP,
    heightCm: null,
    pregnancyWeek: null,
    loading: false,
  });

describe('LogPicker care route', () => {
  it('asks her to add it, and shows no logs, when her route is not known', () => {
    withCare(null);
    const { getByText, queryByText } = render(<LogPicker />);

    expect(getByText('logs.careModelPrompt.action')).toBeTruthy();
    expect(queryByText('logs.picker.publicHint')).toBeNull();
    expect(queryByText('logs.picker.alsoTrack')).toBeNull();
  });

  it('shows the public logs for a public route', () => {
    withCare(CareModelEnum.PUBLIC);
    const { getByText, queryByText } = render(<LogPicker />);

    expect(getByText('logs.picker.publicHint')).toBeTruthy();
    expect(queryByText('logs.careModelPrompt.action')).toBeNull();
  });

  it('shows the private logs for a private route', () => {
    withCare(CareModelEnum.PRIVATE);
    const { getByText, queryByText } = render(<LogPicker />);

    expect(getByText('logs.picker.alsoTrack')).toBeTruthy();
    expect(queryByText('logs.careModelPrompt.action')).toBeNull();
  });
});
