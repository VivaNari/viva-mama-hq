import { IService } from '../types/services.types';

export const servicesdata: IService[] = [
  {
    id: '1',
    title: 'Viva Basic (Free)',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyLabel: 'Free',
  },
  {
    id: '2',
    title: 'Viva Signature',
    monthlyPrice: 999,
    yearlyPrice: 10999,
    yearlyLabel: 'Pay for 11 month & use for 1 year',
  },
];

export const FEATURE_ROWS = [
  'Weekly check-ins',
  '24x7 AI- Powered Chatbot',
  'Personalized Recovery Tracking',
  'Curated Product Recommendations',
  'Weekly Tele - consultation',
  'Early Risk Detection & Action Plans',
  'Comprehensive Recovery Plans',
  'Priority Support',
  'Customized Toolkits & Checklists',
];

export const FEATURES_MATRIX: Record<string, boolean[]> = {
  '1': [true, true, true, true, true, true, false, false, false],
  '2': [true, true, true, true, true, true, true, true, true],
};
