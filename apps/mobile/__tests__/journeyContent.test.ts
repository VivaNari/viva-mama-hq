import { BABY_ROWS, MOTHER_ROWS } from '../src/data/journey/journeyRows';
import { JourneyHelpSet } from '../src/data/journey/journeyTypes';
import content from '../src/i18n/locales/journey/en.json';
import contentHi from '../src/i18n/locales/journey/hi.json';
import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';

const copy = content as any;

const keysOf = (value: any, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) => keysOf(child, `${prefix}${key}.`))
    : [prefix];

describe('the generated Journey content', () => {
  it('has every row in the workbook', () => {
    expect(MOTHER_ROWS).toHaveLength(55);
    expect(BABY_ROWS).toHaveLength(54);
  });

  it('has words for every row, with three Card 3 lines on each route', () => {
    MOTHER_ROWS.forEach(row => {
      const words = copy.mother[row.id];
      expect(words.happening.headline).toBeTruthy();
      expect(words.happening.chips.length).toBeGreaterThan(0);
      for (const side of ['govt', 'private'] as const) {
        expect(words.remember[side]).toHaveLength(3);
        expect(row.remember[side]).toHaveLength(3);
        expect(words.learnMore[side]).toBeTruthy();
      }
    });
    BABY_ROWS.forEach(row => {
      expect(copy.baby[row.id].card1.text).toBeTruthy();
      expect(copy.baby[row.id].card2.govt).toBeTruthy();
      expect(copy.baby[row.id].card3.private).toBeTruthy();
    });
  });

  it('gives every row a help set that has signs', () => {
    [...MOTHER_ROWS, ...BABY_ROWS].forEach(row => {
      expect(copy.help.sets[row.helpSet as JourneyHelpSet].length).toBeGreaterThan(0);
    });
  });

  it('has the numbers to call', () => {
    const dialled = copy.help.numbers.flatMap((entry: { dial: string[] }) => entry.dial);
    expect(dialled).toEqual(expect.arrayContaining(['108', '102', '14416', '181']));
  });

  it('leaves out what the workbook says is never shown to her', () => {
    const text = JSON.stringify(content);
    ['VivaScore', 'V5 recovery', 'EPDS', 'PHQ-2', 'GAD-2', 'Weekly wellness check-in'].forEach(word =>
      expect(text).not.toContain(word),
    );
  });
});

describe('the Hindi Journey content', () => {
  const hiCopy = contentHi as any;

  it('has every line the English has', () => {
    expect(keysOf(hiCopy).sort()).toEqual(keysOf(copy).sort());
  });

  it('has no line left in English', () => {
    const lines = keysOf(copy).filter(key => !key.includes('dial'));
    const at = (root: any, key: string) => key.split('.').filter(Boolean).reduce((node, part) => node[part], root);
    // Vaccine names such as MMR-1 stay as they are.
    const allowed = /^[A-Z0-9, -]+$/;
    lines.forEach(key => {
      const english = at(copy, key);
      if (!allowed.test(english)) expect(at(hiCopy, key)).not.toEqual(english);
    });
  });

  it('keeps the numbers to call exactly as they are', () => {
    expect(hiCopy.help.numbers.map((entry: any) => entry.dial)).toEqual(copy.help.numbers.map((entry: any) => entry.dial));
  });

  it('gives every danger-sign list the same number of signs', () => {
    Object.keys(copy.help.sets).forEach(set => {
      expect(hiCopy.help.sets[set]).toHaveLength(copy.help.sets[set].length);
    });
  });
});

describe('the Journey UI strings', () => {
  it('has the same keys in English and Hindi', () => {
    expect(keysOf((hi as any).journey).sort()).toEqual(keysOf((en as any).journey).sort());
    expect(keysOf((hi as any).logs.pnc).sort()).toEqual(keysOf((en as any).logs.pnc).sort());
  });
});
