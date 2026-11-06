import { ReminderCategory } from '../types/reminder.types';

/** What a reminder can be for: the choices in Add reminder and in the chat's Reminders drawer. */
export const REMINDER_CATEGORIES: { key: ReminderCategory; icon: string }[] = [
    { key: 'medicine', icon: 'pill' },
    { key: 'meals', icon: 'utensils' },
    { key: 'exercise', icon: 'activity' },
    { key: 'tests', icon: 'heart-pulse' },
    { key: 'other', icon: 'plus' },
];
