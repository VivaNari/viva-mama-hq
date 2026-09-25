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
 *
 * None carries a `subtitleKey` any more — see the note on `IInfantCheckinOptions`. Diaper
 * still gets a real line under the title, but it comes from the dashboard's live count
 * (`FLInfantCheckInOptions`'s `subtitle` prop), not from this static data.
 */
export const infantData: IInfantData = {
  checkinOptions: [
    {
      titleKey: 'nav.growthLog',
      screen: 'GrowthLog',
      icon: 'ruler',
    },
    {
      titleKey: 'nav.feedingLog',
      screen: 'FeedingLog',
      icon: 'baby-bottle-outline',
    },
    {
      titleKey: 'nav.diaperLog',
      screen: 'DiaperLog',
      icon: 'water-outline',
    },
    {
      titleKey: 'nav.vaccinationLog',
      screen: 'VaccinationLog',
      icon: 'needle',
    },
    {
      titleKey: 'nav.milestoneLog',
      screen: 'MilestoneLog',
      icon: 'foot-print',
      fullWidth: true,
    },
  ],
};
