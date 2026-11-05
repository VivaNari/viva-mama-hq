import React from 'react';
import { render } from '@testing-library/react-native';

import DashboardMotherTab from '../src/components/dashboard/DashboardMotherTab';
import JourneySnapshot from '../src/components/dashboard/JourneySnapshot';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../src/components/dashboard/HealthSummaryCard', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>health-summary-card</Text> };
});
jest.mock('../src/components/CareManagerCard', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>request-a-call-card</Text> };
});

describe('JourneySnapshot', () => {
  it('shows the stage bar and the body, baby and upcoming cards', () => {
    const { getByText, getAllByText } = render(<JourneySnapshot />);

    expect(getAllByText('Pregnancy')).toHaveLength(2);
    expect(getByText('Motherhood & toddler')).toBeTruthy();
    expect(getByText('Day 168 of 1000')).toBeTruthy();
    expect(getByText('Your body this week')).toBeTruthy();
    expect(getByText('Your baby this week')).toBeTruthy();
    expect(getByText('PMSMA checkup, the 9th')).toBeTruthy();
  });

  it('has no route toggle or weekly summary', () => {
    const { queryByText } = render(<JourneySnapshot />);

    expect(queryByText('Public journey')).toBeNull();
    expect(queryByText('Private journey')).toBeNull();
    expect(queryByText('Your week, in short')).toBeNull();
  });
});

describe('DashboardMotherTab', () => {
  it('shows the Journey design, the health summary and the request a call card', () => {
    const { getByText } = render(<DashboardMotherTab />);

    expect(getByText('What\'s upcoming')).toBeTruthy();
    expect(getByText('health-summary-card')).toBeTruthy();
    expect(getByText('request-a-call-card')).toBeTruthy();
    expect(getByText('dashboard.careManagerDisclaimer')).toBeTruthy();
  });

  it('no longer shows the sections that are commented out', () => {
    const { queryByText } = render(<DashboardMotherTab />);

    expect(queryByText('dashboard.recoveryScore')).toBeNull();
    expect(queryByText('dashboard.connectHealthcare')).toBeNull();
    expect(queryByText('dashboard.seeAllExperts')).toBeNull();
  });
});
