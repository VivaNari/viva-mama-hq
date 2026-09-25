import {
  _id,
  _times,
  _boolean,
  _careTeam,
  _fullName,
  _taskNames,
  _postTitles,
  _description,
} from './_mock';

// ----------------------------------------------------------------------

export const _myAccount = {
  displayName: 'Dr. Ritu Verma',
  email: 'ritu.verma@vivamama.app',
  photoURL: '/assets/images/avatar/avatar-25.webp',
};

// ----------------------------------------------------------------------

const STAGES = [
  '0–6 weeks',
  '6–12 weeks',
  '3–6 months',
  '6–12 months',
  '0–6 weeks',
  '3–6 months',
  '6–12 weeks',
  '6–12 months',
  '0–6 weeks',
  '3–6 months',
];

export const _mothers = [...Array(24)].map((_, index) => ({
  id: _id(index),
  name: _fullName(index),
  careTeam: _careTeam(index),
  isVerified: _boolean(index),
  avatarUrl: `/assets/images/avatar/avatar-${index + 1}.webp`,
  status: index % 4 ? 'active' : 'paused',
  stage: STAGES[index % STAGES.length],
}));

// ----------------------------------------------------------------------

export const _posts = [...Array(23)].map((_, index) => ({
  id: _id(index),
  title: _postTitles(index),
  description: _description(index),
  coverUrl: `/assets/images/cover/cover-${index + 1}.webp`,
  totalViews: 8829,
  totalComments: 7977,
  totalShares: 8556,
  totalFavorites: 8870,
  postedAt: _times(index),
  author: {
    name: _fullName(index),
    avatarUrl: `/assets/images/avatar/avatar-${index + 1}.webp`,
  },
}));

// ----------------------------------------------------------------------

export const _timeline = [...Array(5)].map((_, index) => ({
  id: _id(index),
  title: [
    'Mood screening flagged for review — Ananya S.',
    '12 week-2 check-ins completed',
    'New article published: Healing after a C-section',
    'Care team assigned to 6 new mothers',
    '3 mothers completed the fourth trimester programme',
  ][index],
  type: `order${index + 1}`,
  time: _times(index),
}));

export const _signupChannels = [
  {
    value: 'facebook',
    label: 'Facebook',
    total: 19500,
  },
  {
    value: 'google',
    label: 'Google',
    total: 91200,
  },
  {
    value: 'linkedin',
    label: 'Clinic referral',
    total: 69800,
  },
  {
    value: 'twitter',
    label: 'Community',
    total: 84900,
  },
];

export const _tasks = Array.from({ length: 5 }, (_, index) => ({
  id: _id(index),
  name: _taskNames(index),
}));

// ----------------------------------------------------------------------

export const _notifications = [
  {
    id: _id(1),
    title: 'Mood screening flagged',
    description: 'EPDS score of 14 needs review',
    avatarUrl: null,
    type: 'alert',
    postedAt: _times(1),
    isUnRead: true,
  },
  {
    id: _id(2),
    title: _fullName(2),
    description: 'replied in the fourth trimester group',
    avatarUrl: '/assets/images/avatar/avatar-2.webp',
    type: 'friend-interactive',
    postedAt: _times(2),
    isUnRead: true,
  },
  {
    id: _id(3),
    title: 'New care team messages',
    description: '5 unread messages',
    avatarUrl: null,
    type: 'chat-message',
    postedAt: _times(3),
    isUnRead: false,
  },
  {
    id: _id(4),
    title: 'Weekly report ready',
    description: 'Recovery outcomes for last week',
    avatarUrl: null,
    type: 'mail',
    postedAt: _times(4),
    isUnRead: false,
  },
  {
    id: _id(5),
    title: 'Check-in reminder sent',
    description: '38 mothers due for a week-2 check-in',
    avatarUrl: null,
    type: 'reminder',
    postedAt: _times(5),
    isUnRead: false,
  },
];
