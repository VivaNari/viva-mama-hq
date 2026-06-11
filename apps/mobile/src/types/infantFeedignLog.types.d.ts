export type FeedingScheduleEntry = {
  time: string;
  type: 'Nursing' | 'Bottle' | 'Pump' | null;
  amount: string;
};

export type SleepLogEntry = {
  start: string;
  end: string;
  length: string;
};

export type ActivitiesState = {
  [key: string]: boolean;
};

export type MoodsState = {
  [key: string]: boolean;
};

export type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};
