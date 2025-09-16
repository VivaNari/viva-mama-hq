import { IOnboardingStep } from '../types';

export const phqdata: IOnboardingStep[] = [
  {
    phq: [
      {
        question: 'Enter your name',
        answerType: 'text',
        isMultichoice: false,
        placeholder: 'Name',
        options: [],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Date of birth',
        answerType: 'datetime',
        isMultichoice: false,
        placeholder: 'DD/MM/YYYY',
        options: [],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Height in centimeter',
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Height',
        options: [],
        isRequired: true,
        answer: 0,
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Enter Weight',
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Weight',
        options: [],
        isRequired: true,
        answer: 0,
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Did you have any of the conditions during your pregnancy?',
        answerType: 'select',
        isMultichoice: true,
        placeholder: '',
        options: [
          { label: 'Anemia', value: 0 },
          { label: 'Gestational Diabetes', value: 1 },
          { label: 'High Blood Pressure', value: 2 },
          { label: 'Thyroid', value: 3 },
          { label: 'Fibroids', value: 4 },
          { label: 'Obesity', value: 5 },
          { label: 'Twins', value: 6 },
          { label: 'None of the above', value: 7 },
        ],
        isRequired: false,
        answer: [] as number[],
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'How was your pregnancy conceived?',
        answerType: 'select',
        isMultichoice: false,
        placeholder: '',
        options: [
          { label: 'Natural', value: 0 },
          { label: 'Assisted IVF', value: 1 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Date of delivery',
        answerType: 'datetime',
        isMultichoice: false,
        placeholder: 'DD/MM/YYYY',
        options: [],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'What type of delivery did you have?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'C-Section', value: 0 },
          { label: 'Perineal/Vaginal', value: 1 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'What was the outcome of your most recent delivery?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'Live Birth', value: 0 },
          { label: 'Still Birth', value: 1 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Do you have a history of alcohol or smoking use?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'Yes', value: 0 },
          { label: 'No', value: 1 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: false,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Is this your first or second child?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'First Child', value: 0 },
          { label: 'Second Child', value: 1 },
          { label: 'Third Child or more', value: 2 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
  {
    phq: [
      {
        question:
          'Have you ever experienced any mental health concerns such as anxiety, depression?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'Yes', value: 0 },
          { label: 'No', value: 1 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: false,
      },
    ],
  },
  {
    phq: [
      {
        question: 'What is your current family set-up?',
        answerType: 'select',
        isMultichoice: false,
        options: [
          { label: 'Nuclear (you, partner, and children)', value: 0 },
          { label: 'Joint (extended family living together)', value: 1 },
          { label: 'Single parent', value: 2 },
          { label: 'Living alone temporarily', value: 3 },
        ],
        isRequired: true,
        answer: '',
        isEPHIData: false,
      },
    ],
  },
  {
    phq: [
      {
        question: 'Child Height',
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Height',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
      {
        question: 'Child Weight',
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Weight',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
      {
        question: 'Child Circumference',
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Circumference',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
];
