import { IInfantData } from '../types/infantData.types';

/**
 * Static scaffolding for the Infant tab.
 *
 * `scoreImage` used to live here, pointing at a static WHO growth-chart JPEG. Both the
 * dashboard and the Growth Log now render a real chart from @vivamama/growth-standards, so
 * the placeholder and its asset are gone.
 *
 * `age` used to live here as the string '15 days'. It is now derived per child from the
 * real date of birth by getChildAgeLabel — a hardcoded age was fine for a mock and wrong
 * the moment children became real records.
 *
 * Tile order follows the design: Growth and Feeding, then Diaper and Vaccination, with
 * Milestone spanning the last row.
 */
export const infantData: IInfantData = {
  checkinOptions: [
    {
      titleKey: 'nav.growthLog',
      screen: 'GrowthLog',
      icon: 'ruler',
      subtitleKey: 'infant.tileNotLogged',
    },
    {
      titleKey: 'nav.feedingLog',
      screen: 'FeedingLog',
      icon: 'baby-bottle-outline',
      subtitleKey: 'infant.tileNotLogged',
    },
    {
      titleKey: 'nav.diaperLog',
      screen: 'DiaperLog',
      icon: 'water-outline',
      subtitleKey: 'infant.tileNotLogged',
    },
    {
      titleKey: 'nav.vaccinationLog',
      screen: 'VaccinationLog',
      icon: 'needle',
      subtitleKey: 'infant.tileSchedulePending',
    },
    {
      titleKey: 'nav.milestoneLog',
      screen: 'MilestoneLog',
      icon: 'foot-print',
      subtitleKey: 'infant.tileNotLogged',
      fullWidth: true,
    },
  ],
};
