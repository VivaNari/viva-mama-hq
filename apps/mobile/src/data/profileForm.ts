import { IFormField } from '../types/profile.types';

export const profileFormFields: IFormField[] = [
  {
    key: 'name',
    label: 'Your name',
    placeholder: 'Enter your name',
    type: 'text',
  },
  { key: 'age', label: 'Age', placeholder: 'Enter your age', type: 'number' },
  {
    key: 'height',
    label: 'Height',
    placeholder: 'Enter your height',
    type: 'text',
  },
  {
    key: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    type: 'email',
  },
];
