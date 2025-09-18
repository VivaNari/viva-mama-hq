import { IService } from '../types/services.types';

export const servicesdata: IService[] = [
  {
    id: '1',
    title: 'Viva Signature',
    monthlyPrice: '₹4999 / mo',
    yearlyPrice: '₹60000 / yearly',
    yearlyLabel: '₹60000 / yearly',
  },
  {
    id: '2',
    title: 'Viva Luxe',
    monthlyPrice: '₹2499 / mo',
    yearlyPrice: '₹30000 / yearly',
    yearlyLabel: '₹30000 / yearly',
  },
  {
    id: '3',
    title: 'Viva Lite',
    monthlyPrice: '₹999 / mo',
    yearlyPrice: '₹12000 / yearly',
    yearlyLabel: '₹12000 / yearly',
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
  '3': [true, true, true, true, false, false, false, false, false],
  '2': [true, true, true, true, true, true, false, false, false],
  '1': [true, true, true, true, true, true, true, true, true],
};
