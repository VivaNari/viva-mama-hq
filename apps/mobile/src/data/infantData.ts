import { IInfantData } from '../types/infantData.types';

export const infantData: IInfantData = {
  age: '15 days',
  scoreImage: require('../public/assets/images/infant_growth_chart.jpg'),
  description:
    'An infant growth score helps track a baby’s weight, height, and overall development compared to healthy standards. It provides parents and doctors with useful insights to monitor nutrition, identify milestones, and detect any growth delays at an early stage for timely care.',
  checkinOptions: [
    {
      title: 'Milestone Log',
      screen: 'MilestoneLog',
    },
    {
      title: 'Feeding Log',
      screen: 'FeedingLog',
    },
    {
      title: 'Diaper Log',
      screen: 'DiaperLog',
    },
    {
      title: 'Growth Log',
      screen: 'GrowthLog',
    },
    {
      title: 'Vaccination Log',
      screen: 'VaccinationLog',
    },
  ],
};
