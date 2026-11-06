/**
 * The buttons above the Viva chat box, which replaced the Viva AI hub. Real translations,
 * so a missing label shows here as a raw key rather than on her phone.
 *
 * Run:  npx jest chatTriggers
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import ChatTriggers from '../src/components/chat/ChatTriggers';
import i18n from '../src/i18n';
import { CareModelEnum, DeliveryOutcomeEnum, UserCategoryEnum } from '../src/types/user.types';

const mockNavigate = jest.fn();
let mockCare: any;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../src/hooks/useCareContext', () => ({ useCareContext: () => mockCare }));
jest.mock('../src/hooks/useCareManagerBooking', () => ({
  useCareManagerBooking: () => ({ credits: 0, hasCredit: false, fee: 0, loading: false, book: jest.fn() }),
}));
jest.mock('../src/components/consultation/ConsultationBookingSheet', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ visible }: any) => (visible ? <Text>booking-sheet</Text> : null) };
});
jest.mock('../src/components/consultation/BookingConfirmedModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/dashboard/ChildAvatarStrip', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>child-strip</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const CHILD = { _id: 'c1', name: 'Asha', date_of_birth: '2026-01-01T00:00:00.000Z', sex: 'Female' };

const care = (over: object = {}) => {
  mockCare = {
    careModel: CareModelEnum.PUBLIC,
    category: UserCategoryEnum.NP,
    deliveryOutcome: null,
    children: [],
    loading: false,
    ...over,
  };
};

const show = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <ChatTriggers />
    </I18nextProvider>,
  );

beforeEach(async () => {
  jest.clearAllMocks();
  care();
  await i18n.changeLanguage('en');
});

it('shows the four buttons', () => {
  const screen = show();
  ['Log', 'Reminders', 'Records', 'Experts'].forEach(label => expect(screen.getByText(label)).toBeTruthy());
});

it('hides the row once she has written something', () => {
  const screen = render(
    <I18nextProvider i18n={i18n}>
      <ChatTriggers hidden />
    </I18nextProvider>,
  );
  expect(screen.queryByText('Log')).toBeNull();
});

describe('Log', () => {
  it('tells a pregnant woman with no child that baby logs start after the birth', () => {
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    expect(screen.getByText('ANC checkup')).toBeTruthy();

    fireEvent.press(screen.getByText('For baby'));
    expect(screen.getByText('Baby logs start after your baby is born.')).toBeTruthy();
    expect(screen.queryByText('Add your baby')).toBeNull();
    expect(screen.queryByText('Growth Log')).toBeNull();
  });

  it('offers Add your baby to a woman who is neither pregnant nor postpartum', () => {
    care({ category: UserCategoryEnum.NN });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText('For baby'));
    expect(screen.getByText('Add your baby')).toBeTruthy();
  });

  it('opens the screen a tile names', () => {
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText('Medicines & supplements'));
    expect(mockNavigate).toHaveBeenCalledWith('MedicineLog', undefined);
  });

  it('gives the baby logs, for her child, after birth', () => {
    care({ category: UserCategoryEnum.PP, children: [CHILD] });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText('For baby'));
    ['Growth Log', 'Feeding Log', 'Diaper Log', 'Vaccination Log', 'Milestone Log'].forEach(label =>
      expect(screen.getByText(label)).toBeTruthy(),
    );
    expect(screen.queryByText('child-strip')).toBeNull();

    fireEvent.press(screen.getByText('Feeding Log'));
    expect(mockNavigate).toHaveBeenCalledWith('FeedingLog', expect.objectContaining({ childId: 'c1', childName: 'Asha' }));
  });

  it('offers Add your baby after birth when no baby is on record', () => {
    care({ category: UserCategoryEnum.PP });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText('For baby'));
    expect(screen.getByText('Add your baby')).toBeTruthy();
    expect(screen.queryByText('Growth Log')).toBeNull();
  });

  it('offers nothing about a baby after a loss with no other child', () => {
    care({ category: UserCategoryEnum.PP, deliveryOutcome: DeliveryOutcomeEnum.STILL_BIRTH });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    expect(screen.queryByText('For baby')).toBeNull();
  });

  it('shows the names when she has more than one child', () => {
    care({ category: UserCategoryEnum.PP, children: [CHILD, { ...CHILD, _id: 'c2', name: 'Veer' }] });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText('For baby'));
    expect(screen.getByText('child-strip')).toBeTruthy();
  });

  it('asks for her care route when it is not known', () => {
    care({ careModel: null });
    const screen = show();
    fireEvent.press(screen.getByText('Log'));
    fireEvent.press(screen.getByText(i18n.t('logs.careModelPrompt.action')));
    expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
  });
});

describe('Reminders', () => {
  it.each([
    ['Medicine', 'medicine'],
    ['Meals', 'meals'],
    ['Exercise', 'exercise'],
    ['Tests / readings', 'tests'],
    ['Other', 'other'],
  ])('opens Add reminder with %s selected', (label, category) => {
    const screen = show();
    fireEvent.press(screen.getByText('Reminders'));
    fireEvent.press(screen.getByText(label));
    expect(mockNavigate).toHaveBeenCalledWith('Reminders', { category });
  });

  it('opens her list from My reminders', () => {
    const screen = show();
    fireEvent.press(screen.getByText('Reminders'));
    fireEvent.press(screen.getByText('My reminders'));
    expect(mockNavigate).toHaveBeenCalledWith('Reminders', undefined);
  });
});

describe('Records', () => {
  it.each([
    ['Upload reports / records', 'RecordsUpload'],
    ['My records', 'HealthRecords'],
    ['Health summary', 'HealthSummary'],
  ])('opens %s', (label, route) => {
    const screen = show();
    fireEvent.press(screen.getByText('Records'));
    fireEvent.press(screen.getByText(label));
    expect(mockNavigate).toHaveBeenCalledWith(route, undefined);
  });
});

describe('Experts', () => {
  it('opens the Experts tab', () => {
    const screen = show();
    fireEvent.press(screen.getByText('Experts'));
    fireEvent.press(screen.getByText('Browse Experts & Specialists'));
    expect(mockNavigate).toHaveBeenCalledWith('DashboardTabNavigator', { screen: 'Experts' });
  });

  it('opens the counsellor booking in place', () => {
    const screen = show();
    fireEvent.press(screen.getByText('Experts'));
    fireEvent.press(screen.getByText('Talk to your Perinatal Counsellor'));
    expect(screen.getByText('booking-sheet')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

it('has the labels in Hindi too', async () => {
  await i18n.changeLanguage('hi');
  const screen = show();
  expect(screen.getByText('रिमाइंडर')).toBeTruthy();
  fireEvent.press(screen.getByText('रिकॉर्ड'));
  expect(screen.getByText('रिपोर्ट और रिकॉर्ड')).toBeTruthy();
});
