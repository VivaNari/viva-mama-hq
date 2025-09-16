export type AnswerType =
  | 'text'
  | 'numeric'
  | 'select'
  | 'checkbox'
  | 'datetime';

export interface IPHQOption {
  label: string;
  value: number;
}

export type AnswerValue = string | number | string[] | number[];

export interface IPHQQuestion {
  question: string;
  answerType: AnswerType;
  isMultichoice: boolean;
  placeholder?: string;
  options: IPHQOption[];
  isRequired: boolean;
  answer: AnswerValue; // can be string, number, or array
  isEPHIData: boolean;
}

export interface IOnboardingStep {
  phq: IPHQQuestion[];
}

export interface IOnboardingStepProps {
  phqsPerStep: IPHQQuestion[];
  step: number;
  phqLength: number;
  currentStep: number;
}

export type AnswersMap = Record<string, AnswerValue>;
