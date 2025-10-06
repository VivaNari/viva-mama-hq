import { Text } from 'react-native';
import { IVivaAIData } from '../types/vivaAi.types';

export const vivaAIData: IVivaAIData[] = [
  {
    id: 1,
    userQuery: 'Why do I have severe pain while nursing my baby?',
    aiResponse:
      "Severe pain while nursing is not normal, and you absolutely deserve support with it. Here's what might be going on, based on expert guidance from my knowledge base: 5 Common Reasons for Severe Pain While Nursing:\n\nShallow latch — Baby isn't taking enough of your breast into their mouth, causing pinching or soreness.\n\nNipple cracks or injury — Repeated friction can lead to bleeding or cuts, making each feed painful.\n\nYeast infection (Thrush) — Burning or stabbing pain during or after feeds, often with shiny or itchy nipples.\n\nBlocked milk duct or mastitis — A hard, painful lump in your breast with redness or even fever.\n\nTongue or lip tie in baby — Baby can't suck properly, which makes feeding painful for you.\n\nYou can book a consultation with our Lactation Consultant Ms. Sulakshana Gore. She's an IBCLC-certified lactation expert and can guide you step by step. Would you like me to schedule an appointment with her?",
  },
  {
    id: 2,
    userQuery: 'Why do I feel so sad all the time these days?',
    aiResponse:
      "I am really sorry you are feeling this way. That sounds incredibly heavy, and you are not alone in it, many new mothers feel this storm of emotions: anger, sadness, guilt, numbness… sometimes all at once. 💔\n\nWhy You Might Be Feeling Angry or Sad After Birth \n\nYour hormones are shifting fast.\nAfter birth, your estrogen and progesterone levels crash, this can trigger deep emotional lows, mood swings, or irritability.\n\nYou're exhausted and overwhelmed. \nSleep deprivation, feeding every few hours, managing pain or healing… it all builds up and can leave you feeling frustrated or numb. \n\nYour needs are being ignored. \nEveryone asks about the baby, but few ask how you're really doing. That can feel lonely and unfair. \n\nPostpartum depression or anxiety may be at play. \nFeeling angry, hopeless, weepy, or disconnected (from yourself or your baby) could be a sign that your mental health needs support and it deserves that care.Would you like help taking a quick mental health check-in (it's just a few questions)?",
    followUpSet: {
      note: "Please answer based on how you've felt over the last 2 weeks, and be as honest as you can — there's no right or wrong.",
      followUps: [
        {
          question:
            'Over the last 2 weeks, how often have you had little interest or pleasure in doing things?',
          questionType: 'select',
          options: [
            { id: 0, label: 'Not at all', value: 0 },
            { id: 1, label: 'Several days', value: 1 },
            { id: 2, label: 'More than half the days', value: 2 },
            { id: 3, label: 'Nearly every day', value: 3 },
          ],
        },
        {
          question:
            'Over the last 2 weeks, how often have you felt down, depressed, or hopeless?',
          questionType: 'select',
          options: [
            { id: 0, label: 'Not at all', value: 0 },
            { id: 1, label: 'Several days', value: 1 },
            { id: 2, label: 'More than half the days', value: 2 },
            { id: 3, label: 'Nearly every day', value: 3 },
          ],
        },
      ],
    },
  },
  {
    id: 3,
    userQuery: 'How to store breastmilk?',
    aiResponse: `Storing breastmilk properly helps keep it safe and nutritious for your baby. Here's a simple video for your reference - See this video - https://drive.google.com/file/d/1Jelr_eU-SDXjJ1crA0ER0xbhG0bIqUlK/view?usp=drive_link`,
  },
];
