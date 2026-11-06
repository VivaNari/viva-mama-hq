import { CARE_SCHEDULES, careScheduleItemIds, isCareScheduleItem } from '@vivamama/care-schedules';

import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';
import { DeliveryOutcomeEnum, DeliveryTypeEnum } from '../src/types/user.types';
import { CareScheduleContext, hasGestationalDiabetes, scheduleFor } from '../src/utils/careSchedule';

const none: CareScheduleContext = { deliveryType: null, deliveryOutcome: null, hasGdm: false };
const ids = (kind: 'anc' | 'pnc', route: 'public' | 'private', context = none) =>
  scheduleFor(kind, route, context).groups.flatMap(group => group.items.map(item => item.id));

describe('the schedule data', () => {
  it('keeps every id already saved in people\'s ticks', () => {
    const shipped = ['g1a', 'g1b', 'g1c', 'g2a', 'g2b', 'g2c', 'g2d', 'g3a', 'g3b', 'g4a', 'g4b',
      'p1a', 'p1b', 'p1c', 'p2a', 'p2b', 'p2c', 'p2d', 'p3a', 'p3b', 'p3c', 'p3d'];
    shipped.forEach(id => expect(isCareScheduleItem('anc', id)).toBe(true));
  });

  it('uses each id once, across both schedules', () => {
    const all = [...careScheduleItemIds('anc'), ...careScheduleItemIds('pnc')];
    expect(new Set(all).size).toBe(all.length);
  });

  it.each([['en', en], ['hi', hi]])('has %s words for every group and item', (_name, locale: any) => {
    for (const kind of ['anc', 'pnc'] as const) {
      for (const route of ['public', 'private'] as const) {
        const copy = locale.logs[kind].schedule[route];
        const schedule = CARE_SCHEDULES[kind][route];
        schedule.groups.forEach(group => {
          expect(copy.groups[group.id]).toBeTruthy();
          group.items.forEach(item => {
            expect(copy[item.id]?.label).toBeTruthy();
            expect(copy[item.id]?.timing).toBeTruthy();
          });
        });
        schedule.recurring.forEach(item => expect(copy[item.id]?.label).toBeTruthy());
      }
    }
  });

  it('has a window that opens before it closes on every item', () => {
    for (const kind of ['anc', 'pnc'] as const) {
      for (const route of ['public', 'private'] as const) {
        CARE_SCHEDULES[kind][route].groups.forEach(group =>
          group.items.forEach(item => expect(item.end).toBeGreaterThanOrEqual(item.start)),
        );
      }
    }
  });
});

describe('scheduleFor', () => {
  it('shows the C-section wound review only after a caesarean', () => {
    expect(ids('pnc', 'private')).not.toContain('m2b');
    expect(ids('pnc', 'private', { ...none, deliveryType: DeliveryTypeEnum.C_SECTION })).toContain('m2b');
  });

  it('shows the postnatal sugar test only with gestational diabetes', () => {
    expect(ids('pnc', 'public')).not.toContain('n3g');
    expect(ids('pnc', 'public', { ...none, hasGdm: true })).toContain('n3g');
  });

  it('hides the feeding check after a stillbirth and keeps her own checks', () => {
    const after = ids('pnc', 'public', { ...none, deliveryOutcome: DeliveryOutcomeEnum.STILL_BIRTH });
    expect(after).not.toContain('n1c');
    expect(after).toContain('n1a');
  });
});

describe('hasGestationalDiabetes', () => {
  it('reads this pregnancy or her history', () => {
    expect(hasGestationalDiabetes({ pregnancy_conditions: ['gestational_diabetes'] })).toBe(true);
    expect(hasGestationalDiabetes({ health_history: ['prior_gdm'] })).toBe(true);
    expect(hasGestationalDiabetes({ pregnancy_conditions: ['anemia'], health_history: [] })).toBe(false);
    expect(hasGestationalDiabetes(null)).toBe(false);
  });
});
