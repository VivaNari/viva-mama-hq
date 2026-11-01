import { describePendingLog } from '../src/components/chatBubble/LogProposalCard';
import { IPendingLog } from '../src/types/chat.types';
import { formatReminderTime, reminderFrequencyLabel, toReminderTime } from '../src/utils/reminderFormat';

// Returns the key with its options, so the assertions read what was asked for.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key) as never;

describe('reminder formatting', () => {
  it('shows 24-hour times as am/pm', () => {
    expect(formatReminderTime('00:05')).toBe('12:05 am');
    expect(formatReminderTime('08:00')).toBe('8:00 am');
    expect(formatReminderTime('12:30')).toBe('12:30 pm');
    expect(formatReminderTime('19:30')).toBe('7:30 pm');
  });

  it('reads a picked time back as HH:MM', () => {
    expect(toReminderTime(new Date(2026, 10, 2, 7, 5))).toBe('07:05');
  });

  it('lists custom days Monday first', () => {
    expect(reminderFrequencyLabel(t, 'en', 'custom', [0, 4, 1])).toBe(
      'logs.reminders.weekdays.1, logs.reminders.weekdays.4, logs.reminders.weekdays.0',
    );
  });

  it('describes a proposed reminder on the chat card', () => {
    const item = {
      _id: '1',
      logType: 'reminder',
      fields: { category: 'other', detail: 'Drink water', time: '19:30', frequency: 'daily' },
      status: 'pending',
    } as unknown as IPendingLog;
    expect(describePendingLog(item, t)).toBe(
      '⏰ Drink water · 7:30 pm · logs.reminders.frequencies.daily',
    );
  });
});
