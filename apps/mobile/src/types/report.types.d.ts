export interface IWeekReport {
  weekNumber: number;
  description: string;
  vivaRecoveryScroreInPercentage: number;
  bmi: {
    value: number;
    category: string;
    type: 'normal' | 'warning' | 'danger';
  };
  note: string;
  activityImage: number;
  recoveryState: string;
  recoveryDescription: IRecoverydescription[];
}

export interface IRecoverydescription {
  section: string;
  dataType: 'text' | 'list';
  data: string[];
}
