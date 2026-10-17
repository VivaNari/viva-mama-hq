/**
 * The generated immunisation schedule, and the translations it depends on.
 *
 * The schedule is emitted from the MCP card workbook by
 * `scripts/generate-vaccination-schedule.mjs`, and the words a parent reads are not in it —
 * a dose carries a key, and the screen builds `infant.vaccination.protects.<key>` from it.
 * That split is what lets the schedule be regenerated without touching the locale files, and
 * it is also the failure mode this file exists for: a regenerated key with no matching
 * translation renders **the raw key string** to a parent. It draws fine, it does not throw,
 * and nothing else in the suite would notice.
 *
 * The structural assertions below are the second half of the same argument. They are fixed
 * numbers on purpose, so that a re-exported workbook which silently dropped rows fails here
 * rather than shipping a shorter card.
 *
 * Run:  npx jest vaccinationSchedule
 */

import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';
import {
    IAP_VACCINATION_VISITS,
    MCP_VACCINATION_VISITS,
    VACCINATION_SCHEDULE,
    VACCINE_KEYS,
} from '../src/data/infantVaccinationData';
import { IVaccinationVisit } from '../src/types/infantLog.types';

const lookup = (bundle: Record<string, unknown>, path: string): unknown =>
    path.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in node) {
            return (node as Record<string, unknown>)[part];
        }
        return undefined;
    }, bundle);

const ALL_VISITS: IVaccinationVisit[] = [
    ...MCP_VACCINATION_VISITS,
    ...IAP_VACCINATION_VISITS,
];

const ALL_DOSES = ALL_VISITS.flatMap((visit) => visit.doses);

describe('the generated schedule', () => {
    /**
     * Six visits, not the sheet's ten. The card runs to sixteen years and everything past
     * twenty-four months is excluded at the generator — recorded there as a decision rather
     * than deleted, so a missing visit cannot be mistaken for an oversight.
     */
    it('carries the card through two years and no further', () => {
        expect(MCP_VACCINATION_VISITS.map((visit) => visit.key)).toEqual([
            'birth',
            '6w',
            '10w',
            '14w',
            '9-12m',
            '16-24m',
        ]);

        const beyond = MCP_VACCINATION_VISITS.filter(
            (visit) => visit.due.unit === 'month' && visit.due.from > 24,
        );
        expect(beyond).toEqual([]);
    });

    it('carries the private schedule through two years as well', () => {
        expect(IAP_VACCINATION_VISITS.map((visit) => visit.key)).toEqual([
            'birth',
            '6w',
            '10w',
            '14w',
            '6m',
            '9m',
            '12m',
            '15m',
            '18m',
        ]);
    });

    it('offers both schedules under the sector a family chose at onboarding', () => {
        expect(VACCINATION_SCHEDULE.public).toBe(MCP_VACCINATION_VISITS);
        expect(VACCINATION_SCHEDULE.private).toBe(IAP_VACCINATION_VISITS);
    });

    it('gives every visit at least one dose', () => {
        for (const visit of ALL_VISITS) {
            expect(visit.doses.length).toBeGreaterThan(0);
        }
    });

    /**
     * A key names the dose, not the sector it was given in.
     *
     * Both schedules put BCG at birth and both reach it through the same row, which is what
     * lets a family that switches sector keep the ticks the two genuinely share. The
     * counterpart matters as much: Pentavalent and DTwP are different products and must
     * *not* share a key, because equating them would tell a parent a dose had been given
     * when it had not.
     */
    it('shares a key where the two schedules give the same dose, and only there', () => {
        const mcp = new Set(MCP_VACCINATION_VISITS.flatMap((v) => v.doses.map((d) => d.key)));
        const iap = new Set(IAP_VACCINATION_VISITS.flatMap((v) => v.doses.map((d) => d.key)));

        for (const shared of ['bcg', 'opv_birth', 'hepatitis_b_birth', 'pcv_1', 'pcv_booster']) {
            expect(mcp.has(shared)).toBe(true);
            expect(iap.has(shared)).toBe(true);
        }

        expect(mcp.has('pentavalent_1')).toBe(true);
        expect(iap.has('pentavalent_1')).toBe(false);
        expect(iap.has('dtwp_dtap_1')).toBe(true);
        expect(mcp.has('dtwp_dtap_1')).toBe(false);
    });

    /**
     * `VACCINE_KEYS` is what the API validates against, and its twin is emitted into the
     * backend in the same run. A key on a card that is not on the list is a dose a parent
     * can tap and the server will reject.
     */
    it('lists every key the two schedules between them render', () => {
        const rendered = new Set(ALL_DOSES.map((dose) => dose.key));

        expect(new Set(VACCINE_KEYS)).toEqual(rendered);
        expect(VACCINE_KEYS).toHaveLength(rendered.size);
    });

    /** The same dose reached from both schedules has to describe itself the same way. */
    it('describes a shared dose identically wherever it is reached from', () => {
        const byKey = new Map<string, string>();

        for (const dose of ALL_DOSES) {
            const shape = JSON.stringify(dose);
            const seen = byKey.get(dose.key);
            if (seen) expect(shape).toEqual(seen);
            byKey.set(dose.key, shape);
        }
    });

    /** A numbered dose needs its number, and an unnumbered one must not carry a stale number. */
    it('numbers exactly the doses the card numbers', () => {
        for (const dose of ALL_DOSES) {
            if (dose.doseKind === 'number') {
                expect(dose.doseNumber).toBeGreaterThan(0);
            }
            if (dose.doseKind === 'single' || dose.doseKind === 'birth') {
                expect(dose.doseNumber).toBeUndefined();
            }
        }
    });
});

describe('the words behind the keys', () => {
    /**
     * The test this file exists for.
     *
     * Every key the schedule references has to resolve in both bundles. i18next returns the
     * key itself when a lookup misses, so the failure is a parent reading
     * "infant.vaccination.protects.fipv_ipv_1" under a vaccine name — silent everywhere else.
     */
    it('says what every dose protects against, in both languages', () => {
        for (const dose of ALL_DOSES) {
            const path = `infant.vaccination.protects.${dose.key}`;
            expect(typeof lookup(en, path)).toBe('string');
            expect(typeof lookup(hi, path)).toBe('string');
        }
    });

    /**
     * Notes are the other half. `note` is a flag rather than a path precisely so the screen
     * can tell an absent note from a missing translation — which only works if a dose that
     * claims a note actually has one, and one that does not claims nothing.
     */
    it('carries a note for exactly the doses that claim one', () => {
        for (const dose of ALL_DOSES) {
            const path = `infant.vaccination.notes.${dose.key}`;

            if (dose.note) {
                expect(typeof lookup(en, path)).toBe('string');
                expect(typeof lookup(hi, path)).toBe('string');
            } else {
                expect(lookup(en, path)).toBeUndefined();
            }
        }
    });

    it('labels every visit, and its parenthetical where the card prints one', () => {
        for (const visit of ALL_VISITS) {
            expect(typeof lookup(en, visit.labelKey)).toBe('string');
            expect(typeof lookup(hi, visit.labelKey)).toBe('string');

            if (visit.detailKey) {
                expect(typeof lookup(en, visit.detailKey)).toBe('string');
                expect(typeof lookup(hi, visit.detailKey)).toBe('string');
            }
        }
    });

    /** The chrome around the list, which no generated key covers. */
    it('translates the labels the screen writes itself', () => {
        const paths = [
            'infant.vaccination.dose.birth',
            'infant.vaccination.dose.number',
            'infant.vaccination.dose.booster',
            'infant.vaccination.dose.boosterNumber',
            'infant.vaccination.supplement',
            'infant.vaccination.progress',
            'infant.vaccination.visitChip',
            'infant.vaccination.visitTitle',
            'infant.vaccination.dueAtBirth',
            'infant.vaccination.dueAround',
            'infant.vaccination.dueBetween',
            'infant.vaccination.givenOn',
            'infant.vaccination.source',
            'infant.vaccination.loadFailed',
            'infant.vaccination.saveFailed',
            'infant.vaccination.noChild',
            'infant.dateFull',
        ];

        for (const path of paths) {
            expect(typeof lookup(en, path)).toBe('string');
            expect(typeof lookup(hi, path)).toBe('string');
        }
    });

    /**
     * No stranded translations either. The old screen carried a hand-typed visit list, and
     * its `visitBirth` / `bcgHint` keys outlived it by a commit — a locale file is the one
     * place dead weight is invisible, because nothing imports it.
     */
    it('leaves no translations behind for doses the schedule no longer has', () => {
        const live = new Set(ALL_DOSES.map((dose) => dose.key));
        const bundle = lookup(en, 'infant.vaccination.protects') as Record<string, string>;

        expect(Object.keys(bundle).filter((key) => !live.has(key))).toEqual([]);
    });
});
