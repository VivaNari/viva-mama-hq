import { IPartnerData } from '../types/addPartner.types';

export const partnerData: IPartnerData = {
  title: 'Vivanari for partners',
  benefits: [
    { id: 1, text: 'Lorem ipsum dolor sit amet' },
    { id: 2, text: 'Lorem ipsum dolor sit amet' },
    { id: 3, text: 'Lorem ipsum dolor sit amet' },
  ],
  code: '738H645',
  steps: [
    {
      id: 1,
      title: 'Step 1 - Invite',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    },
    {
      id: 2,
      title: 'Step 2 - Pair',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    },
  ],
};
