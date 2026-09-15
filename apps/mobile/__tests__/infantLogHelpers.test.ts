/**
 * The arithmetic behind the infant log screens.
 *
 * The feeding summary and the six-month split are the two things on these screens that a
 * parent reads as fact rather than as something they typed, so they are tested directly
 * rather than through a render.
 */
import i18n from '../src/i18n';
import {
  formatChipDate,
  formatFullDate,
  vaccinationDueWindow,
  formatClockTime,
  getAgeInDays,
  isSameDay,
  isSameIstDay,
  isSixMonthsOrOlder,
  istDateKey,
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

describe('formatChipDate', () => {
  /**
   * Built from translated month abbreviations rather than `toLocaleDateString` with
   * options. Hermes does not reliably honour those options and falls back to a long form,
   * which stretches a chip to the width of "13 September 2026" — and the device locale is
   * not the app locale, so a Hindi phone would render an English app's dates in Devanagari.
   */
  it('renders a short "13 Sep" label, not a long localised date', () => {
    const label = formatChipDate(new Date(2026, 8, 13), i18n.t.bind(i18n) as never);

    expect(label).toBe('13 Sep');
    expect(label.length).toBeLessThanOrEqual(6);
  });

  it('is short for every month of the year', () => {
    for (let month = 0; month < 12; month++) {
      const label = formatChipDate(new Date(2026, month, 28), i18n.t.bind(i18n) as never);

      // Longest English abbreviation is 3 characters, plus "28 ".
      expect(label.length).toBeLessThanOrEqual(6);
      expect(label).toMatch(/^28 \w+$/);
    }
  });

  it('translates the month rather than hardcoding English', async () => {
    await i18n.changeLanguage('hi');
    const hindi = formatChipDate(new Date(2026, 8, 13), i18n.t.bind(i18n) as never);
    await i18n.changeLanguage('en');

    expect(hindi).not.toBe('13 Sep');
    expect(hindi).toContain('13');
  });
});

describe('IST calendar days', () => {
  /**
   * The backend keys every calendar day on IST. The app used device-local days, which
   * looked identical in India and drifted everywhere else — a user an hour ahead of IST
   * could have their own "today" rejected by the server as a future date.
   */
  it('reads the IST day, not the device day', () => {
    // 19:00 UTC on the 12th is already 00:30 on the 13th in IST.
    expect(istDateKey(new Date('2026-09-12T19:00:00Z'))).toBe('2026-09-13');
    // 18:00 UTC is still 23:30 on the 12th.
    expect(istDateKey(new Date('2026-09-12T18:00:00Z'))).toBe('2026-09-12');
  });

  it('pads month and day to the YYYY-MM-DD the API expects', () => {
    expect(istDateKey(new Date('2026-01-05T06:00:00Z'))).toBe('2026-01-05');
  });

  it('groups two instants on the same IST day', () => {
    const morning = new Date('2026-09-13T04:00:00Z'); // 09:30 IST
    const evening = new Date('2026-09-13T17:00:00Z'); // 22:30 IST
    const nextDay = new Date('2026-09-13T19:00:00Z'); // 00:30 IST, 14th

    expect(isSameIstDay(morning, evening)).toBe(true);
    expect(isSameIstDay(evening, nextDay)).toBe(false);
  });

  /** The chip label has to name the IST day too, or a chip reads a day off. */
  it('labels a chip by its IST day', () => {
    expect(
      formatChipDate(new Date('2026-09-12T19:00:00Z'), i18n.t.bind(i18n) as never),
    ).toBe('13 Sep');
  });
});

/**
 * When a visit on the immunisation schedule falls due.
 *
 * Tested here rather than only through the screen because the whole point of the helper is
 * the difference between the two units, and one of the two has an edge the calendar has and
 * arithmetic does not — a baby born on the 31st.
 */
describe('vaccinationDueWindow', () => {
  const dob = '2026-03-14T06:00:00Z'; // 14 March 2026, 11:30 IST

  const key = (date: Date) => istDateKey(date);

  /** Weeks are exact: six weeks after birth is forty-two days after birth, always. */
  it('counts weeks as days', () => {
    const window = vaccinationDueWindow(dob, { unit: 'week', from: 6, to: 6 })!;

    expect(key(window.from)).toBe('2026-04-25');
    expect(key(window.to)).toBe('2026-04-25');
  });

  /**
   * Months are calendar months. Nine months after 14 March is 14 December, not 274 days
   * later — a parent checking the card against a birthday expects the day to match.
   */
  it('counts months as calendar months, landing on the same day', () => {
    const window = vaccinationDueWindow(dob, { unit: 'month', from: 9, to: 12 })!;

    expect(key(window.from)).toBe('2026-12-14');
    expect(key(window.to)).toBe('2027-03-14');
  });

  it('carries a window past the end of the year', () => {
    const window = vaccinationDueWindow(dob, { unit: 'month', from: 16, to: 24 })!;

    expect(key(window.from)).toBe('2027-07-14');
    expect(key(window.to)).toBe('2028-03-14');
  });

  /**
   * The edge the calendar has and the arithmetic does not: there is no 31st of February.
   *
   * Clamped to the end of the target month rather than allowed to spill into the next one,
   * because a visit must not appear to fall due in the month after the one the card names.
   */
  it('clamps a day the target month does not have', () => {
    const lastOfJanuary = '2026-01-31T06:00:00Z';

    expect(
      key(vaccinationDueWindow(lastOfJanuary, { unit: 'month', from: 1, to: 1 })!.from),
    ).toBe('2026-02-28');

    // And the leap year it would otherwise get wrong in the other direction.
    expect(
      key(vaccinationDueWindow('2028-01-31T06:00:00Z', { unit: 'month', from: 1, to: 1 })!.from),
    ).toBe('2028-02-29');
  });

  /** Nothing to say is better than a guess, on this screen most of all. */
  it('gives nothing back without a usable date of birth', () => {
    const due = { unit: 'week', from: 6, to: 6 } as const;

    expect(vaccinationDueWindow(undefined, due)).toBeNull();
    expect(vaccinationDueWindow('', due)).toBeNull();
    expect(vaccinationDueWindow('not a date', due)).toBeNull();
  });
});

describe('formatFullDate', () => {
  /** The year is what separates this from the chip format: the schedule runs two years out. */
  it('names the IST day and its year', () => {
    expect(
      formatFullDate(new Date('2026-09-12T19:00:00Z'), i18n.t.bind(i18n) as never),
    ).toBe('13 Sep 2026');
  });
});
