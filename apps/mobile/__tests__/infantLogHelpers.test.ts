/**
 * The arithmetic behind the infant log screens.
 *
 * The feeding summary and the six-month split are the two things on these screens that a
 * parent reads as fact rather than as something they typed, so they are tested directly
 * rather than through a render.
 */
import {
  formatClockTime,
  getAgeInDays,
  isSameDay,
  isSixMonthsOrOlder,
  parseClockTime,
  recentDates,
  splitDuration,
  summariseFeeds,
} from '../src/utils/infantLogHelpers';
import { IFeedEntry } from '../src/types/infantLog.types';

const feed = (time: string): IFeedEntry => ({ time, side: null, amount: '' });

describe('getAgeInDays', () => {
  it('counts whole days since birth', () => {
    const now = new Date('2026-09-13T12:00:00Z');
    expect(getAgeInDays('2026-08-29T12:00:00Z', now)).toBe(15);
  });

  it('returns null when there is no date of birth', () => {
    expect(getAgeInDays(undefined)).toBeNull();
    expect(getAgeInDays('not a date')).toBeNull();
  });

  /** A device clock running behind the server must not render a negative age. */
  it('floors a future date of birth at zero rather than going negative', () => {
    const now = new Date('2026-09-13T12:00:00Z');
    expect(getAgeInDays('2026-09-20T12:00:00Z', now)).toBe(0);
  });
});

describe('isSixMonthsOrOlder', () => {
  const now = new Date('2026-09-13T12:00:00Z');

  it('keeps a five-month-old on the 0–6 month log', () => {
    expect(isSixMonthsOrOlder('2026-05-01T00:00:00Z', now)).toBe(false);
  });

  it('moves a seven-month-old onto the solids log', () => {
    expect(isSixMonthsOrOlder('2026-02-01T00:00:00Z', now)).toBe(true);
  });

  it('switches exactly at 183 days', () => {
    const dobAt183 = new Date(now.getTime() - 183 * 24 * 60 * 60 * 1000);
    const dobAt182 = new Date(now.getTime() - 182 * 24 * 60 * 60 * 1000);

    expect(isSixMonthsOrOlder(dobAt183, now)).toBe(true);
    expect(isSixMonthsOrOlder(dobAt182, now)).toBe(false);
  });

  /**
   * An unknown date of birth gets the log that asks for less. The screen offers a manual
   * switch either way, so this is a default rather than a decision.
   */
  it('falls back to the 0–6 month log when the date of birth is missing', () => {
    expect(isSixMonthsOrOlder(undefined, now)).toBe(false);
  });
});

describe('parseClockTime', () => {
  it('reads both 6:40 and 06:40', () => {
    expect(parseClockTime('6:40')).toBe(400);
    expect(parseClockTime('06:40')).toBe(400);
  });

  /**
   * Strictness matters: a half-typed "6:" parsing as 06:00 would put a feed in the summary
   * that never happened.
   */
  it('rejects half-typed and impossible times', () => {
    expect(parseClockTime('6:')).toBeNull();
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('24:00')).toBeNull();
    expect(parseClockTime('10:75')).toBeNull();
    expect(parseClockTime('morning')).toBeNull();
  });
});

describe('summariseFeeds', () => {
  it('counts only rows with a readable time', () => {
    const summary = summariseFeeds([feed('06:40'), feed(''), feed('nope')]);
    expect(summary.feeds).toBe(1);
  });

  it('has no gap to report until there are two feeds', () => {
    expect(summariseFeeds([feed('06:40')]).longestGapMinutes).toBeNull();
  });

  it('measures the longest gap between consecutive feeds', () => {
    const summary = summariseFeeds([feed('06:40'), feed('09:50'), feed('11:00')]);

    expect(summary.feeds).toBe(3);
    expect(summary.longestGapMinutes).toBe(190);
    expect(splitDuration(summary.longestGapMinutes!)).toEqual({
      hours: 3,
      minutes: 10,
    });
  });

  /** A mother who remembers the 06:40 feed last still gets the right gap. */
  it('sorts times before measuring, so entry order does not matter', () => {
    const inOrder = summariseFeeds([feed('06:40'), feed('09:50')]);
    const outOfOrder = summariseFeeds([feed('09:50'), feed('06:40')]);

    expect(outOfOrder).toEqual(inOrder);
  });
});

describe('formatClockTime', () => {
  it('pads to a 24-hour HH:MM, which is how every logged time is rendered', () => {
    expect(formatClockTime(new Date(2026, 8, 13, 7, 5))).toBe('07:05');
    expect(formatClockTime(new Date(2026, 8, 13, 23, 45))).toBe('23:45');
  });
});

describe('recentDates', () => {
  it('runs backwards from today, today first', () => {
    const now = new Date(2026, 8, 13);
    const dates = recentDates(3, now);

    expect(dates).toHaveLength(3);
    expect(isSameDay(dates[0], now)).toBe(true);
    expect(dates[1].getDate()).toBe(12);
    expect(dates[2].getDate()).toBe(11);
  });

  /** Crossing a month boundary is the case a naive setDate() subtraction gets wrong. */
  it('steps back across the start of a month', () => {
    const dates = recentDates(3, new Date(2026, 8, 1));

    expect(dates[1].getMonth()).toBe(7);
    expect(dates[1].getDate()).toBe(31);
  });
});
