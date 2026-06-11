import { INotification } from '../types/notification.types';

export const notifications: INotification[] = [
  {
    id: 1,
    title: 'baby weekly checkin',
    message: 'get your kid vaccinated on 26 July as its 3rd vaccination',
    targetScreen: 'BabyCheckinScreen',
  },
  {
    id: 2,
    title: 'Do your weekly checkin',
    message: 'do your 3rd week checkin',
    targetScreen: 'WeeklyCheckinScreen',
  },
  {
    id: 3,
    title: 'recommended product',
    message: 'the pillow works better for you get this asap 😍😍',
    targetScreen: 'Products',
  },
  {
    id: 4,
    title: 'Mother commented on your post',
    message:
      'your post - hey ladies, I felt so disconnected with myself, is this normal?, comment - i too feel this…',
    targetScreen: 'ArticleDetails',
    params: { articleId: 1001 },
  },
];
