import { IExpertCategory } from '../types/expert.types';

export const expertData: IExpertCategory[] = [
  {
    id: 1,
    category: 'Obstetrician & Gynaecologist',
    experts: [
      {
        id: 101,
        name: 'Dr Saumya Prasad',
        description:
          "Senior consultant with 10+ years of experience in obstetrics and gynecology. Specializes in high-risk pregnancies and women's health.",
        remuneration: '1000 INR',
        avatar: require('../public/assets/images/doctors/Dr_Saumya_Prasad.png'),
        whatsappNumber: '+919083457878',
      },
      {
        id: 102,
        name: 'Dr Akansha Singh',
        description:
          'Expert in reproductive medicine and fertility treatments. Known for her patient-centric approach and comprehensive care.',
        remuneration: '1000 INR',
        avatar: require('../public/assets/images/doctors/Dr_Akansha_Singh.png'),
        whatsappNumber: '+919330724843',
      },
    ],
  },
  {
    id: 2,
    category: 'General Physician',
    experts: [
      {
        id: 201,
        name: 'Dr Umang Salodia',
        description:
          "Experienced general physician specializing in women's health and preventive medicine.",
        remuneration: '750 INR',
        avatar: require('../public/assets/images/doctors/Dr_Umang_Salodia.png'),
        whatsappNumber: '+919083457878',
      },
    ],
  },
  {
    id: 3,
    category: 'Dietician',
    experts: [
      {
        id: 301,
        name: 'Dr Anuradha Kumari',
        description:
          'Clinical nutritionist expert in pregnancy and postpartum nutrition. Helps mothers maintain optimal health through diet.',
        remuneration: '750 INR',
        avatar: require('../public/assets/images/doctors/Dr_Anuradha_Kumari.png'),
        whatsappNumber: '+919330724843',
      },
    ],
  },
  {
    id: 4,
    category: 'Certified Postpartum Transition Coach',
    experts: [
      {
        id: 401,
        name: 'Dr Harsha Tomar',
        description:
          'Specialized in postpartum care and emotional support. Guides new mothers through their transition to parenthood.',
        remuneration: '750 INR',
        avatar: require('../public/assets/images/doctors/Dr_Harsha_Tomar.png'),
        whatsappNumber: '+919083457878',
      },
    ],
  },
];
