/**
 * The Mother view with the real translations and the real schedule, so a key that does not
 * resolve or a row that is not wired up shows here as raw text rather than on her phone.
 *
 * Run:  npx jest journeyMotherView
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import JourneyMotherView from '../src/components/journey/JourneyMotherView';
import i18n from '../src/i18n';
import { CareModelEnum, DeliveryOutcomeEnum, UserCategoryEnum } from '../src/types/user.types';
import { journeyPosition } from '../src/utils/journeyPosition';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../src/analytics', () => ({ recordError: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ userId: 'u1' }) }));
jest.mock('../src/hooks/useDailyCounter', () => ({
  useDailyCounter: () => ({ value: 3, loading: false, increment: jest.fn(), decrement: jest.fn() }),
}));
jest.mock('../src/utils/motherLogHelpers', () => ({ showLogError: jest.fn(), todayKey: () => '2026-11-06' }));
jest.mock('../src/api/journey.api', () => ({ recordBabyArrived: jest.fn(), recordLabourStarted: jest.fn() }));

const mockGetCareSchedule = jest.fn();
const mockGetReminders = jest.fn();
const mockCreateReminder = jest.fn();
jest.mock('../src/api/motherLogs.api', () => ({
  getCareSchedule: (...args: unknown[]) => mockGetCareSchedule(...args),
}));
jest.mock('../src/api/reminders.api', () => ({
  getReminders: (...args: unknown[]) => mockGetReminders(...args),
  createReminder: (...args: unknown[]) => mockCreateReminder(...args),
}));

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const userAt = (category: UserCategoryEnum, deliveryDate: string, careModel: CareModelEnum, extra: object = {}) =>
  ({
    user: {
      user_category: category,
      onboarding_data: {
        delivery_date: deliveryDate,
        care_model: careModel,
        delivery_type: null,
        delivery_outcome: null,
        ...extra,
      },
    },
  }) as any;

const show = (userData: any) =>
  render(
    <I18nextProvider i18n={i18n}>
      <JourneyMotherView position={journeyPosition(userData.user)} userData={userData} onChanged={jest.fn()} />
    </I18nextProvider>,
  );

const settled = () => waitFor(() => expect(mockGetReminders).toHaveBeenCalled());

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetCareSchedule.mockResolvedValue([]);
  mockGetReminders.mockResolvedValue([]);
  mockCreateReminder.mockResolvedValue({});
  await i18n.changeLanguage('en');
});

describe('at week 28', () => {
  it('shows the stage, all three cards and the help link to a public woman', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PUBLIC));
    await settled();

    expect(screen.getByText('Week 28')).toBeTruthy();
    expect(screen.getByText('Third trimester: count the kicks')).toBeTruthy();
    expect(screen.getByText('Strong kicks')).toBeTruthy();
    expect(screen.getByText('12 weeks to your due date')).toBeTruthy();
    expect(screen.getByText('PMSMA free specialist check')).toBeTruthy();
    expect(screen.getByText('Take your MCP card and show your logs at the visit')).toBeTruthy();
    expect(screen.getByText('Log baby moved')).toBeTruthy();
    expect(screen.getByText('When to get help')).toBeTruthy();
    expect(mockGetCareSchedule).toHaveBeenCalledWith('anc');
  });

  it('shows the private route its own items', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PRIVATE));
    await settled();

    expect(screen.getByText('OGCT / GTT for gestational diabetes')).toBeTruthy();
    expect(screen.queryByText('PMSMA free specialist check')).toBeNull();
    expect(screen.getByText('Log 10 kicks')).toBeTruthy();
    expect(screen.getByText('Share your summary before your ANC 3 visit')).toBeTruthy();
  });

  it('moves on when she has ticked an item', async () => {
    mockGetCareSchedule.mockResolvedValue(['p2b']);
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PRIVATE));

    await waitFor(() => expect(screen.queryByText('OGCT / GTT for gestational diabetes')).toBeNull());
    expect(screen.getByText('Growth scan')).toBeTruthy();
  });

  it('sets a one-time reminder for the next item, once', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PRIVATE));
    await settled();

    fireEvent.press(screen.getByText('Remind me'));
    await waitFor(() => expect(screen.getByText('Reminder set')).toBeTruthy());

    expect(mockCreateReminder).toHaveBeenCalledTimes(1);
    expect(mockCreateReminder.mock.calls[0][0]).toMatchObject({
      category: 'other',
      detail: 'OGCT / GTT for gestational diabetes',
      frequency: 'once',
      time: '08:00',
    });
  });

  it('opens the full schedule on the schedule tab', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PRIVATE));
    await settled();

    fireEvent.press(screen.getByText(/See full schedule/));
    expect(mockNavigate).toHaveBeenCalledWith('AncCheckup', { tab: 'schedule' });
  });

  it('opens the screen a Remember tile names', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PRIVATE));
    await settled();

    fireEvent.press(screen.getByText('Take iron and calcium'));
    expect(mockNavigate).toHaveBeenCalledWith('MedicineLog');
  });

  it('has no delivery buttons yet', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PUBLIC));
    await settled();
    expect(screen.queryByText('My baby is here')).toBeNull();
  });
});

describe('around the birth', () => {
  it('offers both delivery buttons from week 37', async () => {
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(21), CareModelEnum.PUBLIC));
    await settled();
    expect(screen.getByText('My baby is here')).toBeTruthy();
    expect(screen.getByText('My labour has started')).toBeTruthy();
  });

  it('asks instead of assuming, when only the due date moved her on', async () => {
    const screen = show(
      userAt(UserCategoryEnum.PP, daysFromNow(-2), CareModelEnum.PUBLIC, { delivery_date_estimated: true }),
    );
    await settled();
    expect(screen.getByText('Has your baby arrived?')).toBeTruthy();
    expect(screen.queryByText('The first week: your body is healing')).toBeNull();
  });

  it('reads the PNC schedule after the birth', async () => {
    const screen = show(userAt(UserCategoryEnum.PP, daysFromNow(-5), CareModelEnum.PUBLIC));
    await settled();

    expect(mockGetCareSchedule).toHaveBeenCalledWith('pnc');
    expect(screen.getByText('The first week: your body is healing')).toBeTruthy();
    expect(screen.getByText('Your postnatal checks')).toBeTruthy();
    expect(screen.getAllByText('ASHA home visit')).toHaveLength(2);
    expect(screen.queryByText('My baby is here')).toBeNull();
  });
});

describe('where no stage applies', () => {
  it('shows nothing about stages or a baby after a loss, and keeps the help link', () => {
    const screen = show(
      userAt(UserCategoryEnum.PP, daysFromNow(-5), CareModelEnum.PUBLIC, {
        delivery_outcome: DeliveryOutcomeEnum.STILL_BIRTH,
      }),
    );
    expect(screen.getByText('We are here with you')).toBeTruthy();
    expect(screen.getByText('When to get help')).toBeTruthy();
    expect(screen.queryByText('Remember today')).toBeNull();
    expect(screen.queryByText('Coming up')).toBeNull();
  });

  it('gives someone not pregnant a plain card', () => {
    const screen = show({ user: { user_category: UserCategoryEnum.NN, onboarding_data: {} } });
    expect(screen.getByText('Your journey starts when you are ready')).toBeTruthy();
  });
});

describe('in Hindi', () => {
  it('shows Hindi UI strings, with the content in English until it is approved', async () => {
    await i18n.changeLanguage('hi');
    const screen = show(userAt(UserCategoryEnum.NP, daysFromNow(84), CareModelEnum.PUBLIC));
    await settled();

    expect(screen.getByText('आज याद रखें')).toBeTruthy();
    expect(screen.getByText('Third trimester: count the kicks')).toBeTruthy();
    expect(screen.getByText('मदद कब लें')).toBeTruthy();
  });
});
