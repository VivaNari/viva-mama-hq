import { IWeekReport } from '../types/report.types';

export const fullReportData: IWeekReport = {
  weekNumber: 1,
  description:
    "Great start to your postpartum journey! You're recovering well. Continue weekly check-ins and self-care. Reach out if anything specific arises.",
  vivaRecoveryScroreInPercentage: 50,
  bmi: {
    value: 24,
    category: 'Healthy weight',
    type: 'normal',
  },
  note: 'Recovery is almost complete but needs final support. Focus on emotional wellbeing and unresolved symptoms. Consider expert guidance.',
  activityImage: require('../public/assets/images/recovery_chart.jpeg'),
  recoveryState: 'Recovery Begins',
  recoveryDescription: [
    {
      section: 'Week Opening Message',
      dataType: 'text',
      data: [
        "You did something amazing. Now it's time to rest, heal, and receive care!",
        "Your body is recovering and your emotions may feel all over the place — that's okay. Let's take it one gentle step at a time.",
      ],
    },
    {
      section: 'Your Healing Journey This Week',
      dataType: 'list',
      data: [
        'Bleeding (bright red, like heavy period) begins to slow',
        'Soreness around stitches or C-section incision',
        'Breast fullness as milk comes in',
        'Emotional ups and downs — baby blues are common',
        'Frequent urination and sweating',
        'Limited mobility, fatigue',
      ],
    },
    {
      section: 'When to Check In With an Expert',
      dataType: 'list',
      data: [
        'Sudden heavy bleeding or large clots',
        'High fever (≥ 100.4°F / 38°C)',
        'Intense abdominal pain',
        'Red, swollen, or oozing stitches',
        'Feeling persistently low, anxious, or overwhelmed',
      ],
    },
  ],
};
