import { IOnboardingStep } from '../types';

export const phqdata: IOnboardingStep[] = [
  {
    phq: [
      {
        preQuestionText:
          "Hi there! I'm Viva, your personal postpartum guide. I'm here to support you on this journey. To get started, what should I call you?",
        question: 'Enter your name',
        postAnswerText:
          "It's so nice to meet you! Thank you for trusting me to be a part of this.",
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
        preQuestionText:
          'To personalize your care plan, I just need a few basic details.',
        question: 'What is your date of birth?',
        postAnswerText: 'Perfect, thank you.',
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
        question: 'Height in centimeters',
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
        question: 'Enter your current weight in kg',
        postAnswerText: "Great, that's all for the basics.",
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
        preQuestionText:
          'Now for some health questions. Please know everything you share is safe with me and helps me to help you better.',
        question:
          'Did you have any of these conditions during your pregnancy? You can select more than one.',
        postAnswerText:
          "Thank you for sharing that. It's really helpful for me to understand your journey.",
        answerType: 'select',
        isMultichoice: true,
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
        preQuestionText: "You're doing great! Just a few more to go.",
        question: 'How was your pregnancy conceived?',
        answerType: 'select',
        isMultichoice: false,
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
        preQuestionText: "Let's talk a little about the delivery.",
        question: 'What was your date of delivery?',
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
        preQuestionText:
          "This next question can be difficult for some. Please take your time, and know that I'm here for you.",
        question: 'What was the outcome of your most recent delivery?',
        postAnswerText:
          'Thank you for your honesty. I appreciate you trusting me with this.',
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
        preQuestionText: 'Now, a couple of quick lifestyle questions.',
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
        question: 'Is this your first, second, or third (or more) child?',
        postAnswerText: 'Wonderful! Every child brings a new adventure.',
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
        preQuestionText:
          "Your emotional well-being is our absolute top priority. Don't worry, we'll get through this together. This is a safe space.",
        question:
          'Have you ever experienced any mental health concerns such as anxiety or depression?',
        postAnswerText:
          "I appreciate you sharing that with me. It's brave and important, and helps me know how to best support you.",
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
        preQuestionText:
          'It often takes a village to raise a child, and your support system is key.',
        question: 'What is your current family set-up?',
        postAnswerText:
          'That helps me understand your environment better. Thank you.',
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
        preQuestionText:
          "We're at the final step! Just a few details about your little one, if you have them handy. It's perfectly okay to skip this if you don't.",
        question: "Child's Height",
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Height in cm',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
      {
        question: "Child's Weight",
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Weight in kg',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
      {
        question: "Child's Head Circumference",
        answerType: 'numeric',
        isMultichoice: false,
        placeholder: 'Circumference in cm',
        options: [],
        isRequired: false,
        answer: '',
        isEPHIData: true,
      },
    ],
  },
];
