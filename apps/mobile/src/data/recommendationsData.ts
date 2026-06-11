import { IRecommendationItem } from '../types/recommendation.types';

export const recommendationsData: IRecommendationItem[] = [
  {
    id: 1,
    title: 'Restful sleep with short breaks > 6 hours',
    content:
      'Maintain current rest patterns, take naps when baby sleeps, reduce screen use at night, and practice a brief wind-down routine- try a short calming routine before bed to help your body relax and sleep better. This could include putting away your phone, dimming the lights, taking a warm shower, doing a few gentle stretches, and taking deep breaths while listening to soft music or silence.',
    image: require('../public/assets/images/recommendations.png'),
  },
  {
    id: 2,
    title: 'Normal Bleeding (2-3 pads/day)',
    content:
      'Your bleeding appears normal for this stage. Continue using sanitary pads and change them regularly. If you notice any sudden increase in bleeding, large clots, or unusual odors, contact your healthcare provider. Remember to maintain good hygiene and wash your hands before and after changing pads.',
    image: require('../public/assets/images/recommendations.png'),
  },
  {
    id: 3,
    title: 'No urine issues',
    content:
      'Your urinary function is normal. Continue staying hydrated and emptying your bladder regularly. Practice pelvic floor exercises as recommended by your healthcare provider. If you experience any burning sensation, difficulty urinating, or incontinence, seek medical advice.',
    image: require('../public/assets/images/recommendations.png'),
  },
  {
    id: 4,
    title: 'Normal bowel movements',
    content:
      "Your bowel movements are regular. Maintain a fiber-rich diet, stay hydrated, and don't delay when you need to go. Include plenty of fruits, vegetables, and whole grains in your diet. If you experience constipation or discomfort, gentle walking can help stimulate bowel movements.",
    image: require('../public/assets/images/recommendations.png'),
  },
  {
    id: 5,
    title: 'Walking comfortably and independently',
    content:
      "You're showing good mobility. Continue with gentle walking and gradually increase duration as comfortable. Listen to your body and don't overexert yourself. Maintain good posture while walking and use appropriate footwear. If you experience any pain or discomfort, slow down and rest.",
    image: require('../public/assets/images/recommendations.png'),
  },
];
