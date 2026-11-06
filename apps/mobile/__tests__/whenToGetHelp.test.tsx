import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import WhenToGetHelp from '../src/components/journey/WhenToGetHelp';
import mockContent from '../src/i18n/locales/journey/en.json';

jest.mock('../src/analytics', () => ({ recordError: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (ns !== 'journeyContent') return key;
      const found = key.split('.').reduce((node: any, part) => node?.[part], mockContent);
      return options?.returnObjects ? found : String(found);
    },
  }),
}));

describe('WhenToGetHelp', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('keeps the signs folded away until she opens it', () => {
    const { queryByText, getByText } = render(<WhenToGetHelp helpSet="pregnancyLate" />);
    expect(queryByText('Baby moving less than usual')).toBeNull();

    fireEvent.press(getByText('journey.help.link'));
    expect(getByText('Baby moving less than usual')).toBeTruthy();
  });

  it('shows the signs for her stage, not another one', () => {
    const { queryByText, getByText } = render(<WhenToGetHelp helpSet="postpartum" />);
    fireEvent.press(getByText('journey.help.link'));

    expect(getByText('Heavy bleeding, soaking a pad in an hour')).toBeTruthy();
    expect(queryByText('Baby moving less than usual')).toBeNull();
  });

  it('dials each number', () => {
    const { getByText } = render(<WhenToGetHelp helpSet="newborn" />);
    fireEvent.press(getByText('journey.help.link'));

    for (const number of ['108', '102', '14416', '181']) {
      fireEvent.press(getByText(number));
      expect(Linking.openURL).toHaveBeenCalledWith(`tel:${number}`);
    }
  });
});
