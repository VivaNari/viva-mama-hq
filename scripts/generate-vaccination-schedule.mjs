/**
 * Converts the MCP card's Vaccinations sheet into source the app and the API both read from.
 *
 * Run:  node scripts/generate-vaccination-schedule.mjs
 *
 * Same argument as its sibling `generate-milestone-catalogue.mjs`: the schedule is
 * transcribed from a government publication (India Mother and Child Protection Card, 2018 —
 * the Universal Immunization Programme / NIS schedule), and the dose keys are primary keys
 * in the database. Being able to re-run this and get an empty `git diff` is the audit trail.
 *
 * Emits three files; all three are generated and must not be hand-edited:
 *   apps/mobile/src/data/infantVaccinationData.ts  visits, dose keys, due windows
 *   services/backend/src/constants/vaccine-keys.ts the key list, for request validation
 *   scripts/out/vaccination-en.json                English copy, merged into en.json
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx");

/**
 * The sheet's visit ages, mapped to a key and a due window.
 *
 * Hand-written rather than parsed out of the age string, for two reasons. The keys appear in
 * chip state and in i18n paths and should be chosen rather than derived; and the due window
 * is arithmetic the label only *implies* — "6 weeks (1½ months)" has to become six weeks
 * after the date of birth before a screen can say when a visit is due.
 *
 * `unit` is week or month rather than a day count because months are calendar months: the
 * 16–24 month window has to land on the same day of the month as the birthday, not 487 days
 * later.
 */
const VISITS = [
    { match: "Birth (within 24 hrs)", key: "birth", unit: "week", from: 0, to: 0 },
    { match: "6 weeks (1½ months)", key: "6w", unit: "week", from: 6, to: 6 },
    { match: "10 weeks (2½ months)", key: "10w", unit: "week", from: 10, to: 10 },
    { match: "14 weeks (3½ months)", key: "14w", unit: "week", from: 14, to: 14 },
    { match: "9–12 months", key: "9-12m", unit: "month", from: 9, to: 12 },
    { match: "16–24 months", key: "16-24m", unit: "month", from: 16, to: 24 },

    /**
     * Transcribed from the card and deliberately not shipped — the app is being built
     * through two years, and these are all beyond it.
     *
     * Kept here rather than deleted so the sheet still parses: the loop below throws on an
     * age it does not recognise, which is what stops a re-exported workbook silently
     * dropping a visit. An excluded visit is a decision recorded in the code; a missing one
     * would be indistinguishable from a mistake. Removing the flag is all it takes to ship
     * one — the rows are still in the workbook and still come through the parser.
     *
     * This is also why the dose parser below never sees "3rd–9th dose" or "—": exclusion
     * happens before a row is built, exactly as the milestone generator drops its 3-year
     * band before slugging it.
     */
    { match: "2–5 years", key: "2-5y", exclude: true },
    { match: "5–6 years", key: "5-6y", exclude: true },
    { match: "10 years", key: "10y", exclude: true },
    { match: "16 years", key: "16y", exclude: true },
];

/**
 * The private-sector schedule, which the workbook does not carry.
 *
 * The MCP card is the government schedule. A family that chose "private" at baby onboarding
 * follows the paediatrician-administered IAP calendar instead, which covers the same
 * diseases on a denser one with combination vaccines — and the app has had that switch since
 * the log screens were first built.
 *
 * It lives here, in the generator, rather than in a hand-maintained data file, so that both
 * schedules are emitted from one run into both outputs. A hand-written half would be exactly
 * the drift this generator exists to prevent: the app's list and the API's validator would
 * be two transcriptions of the same thing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * CLINICAL REVIEW REQUIRED for this table only. The government half above is transcribed
 * from the card and verifiable against it; this half is not. Reconcile against the IAP
 * schedule and have it signed off, because a missing or misdated row reads to a mother as
 * "not due".
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Written in the sheet's own (vaccine, dose, protects, note) shape so the same key function,
 * the same dose parser and the same collision check apply to both halves without a branch.
 */
const IAP = [
    {
        key: "birth",
        age: "Birth (within 24 hrs)",
        unit: "week",
        from: 0,
        to: 0,
        doses: [
            ["BCG", "Single dose", "Tuberculosis", "Given at birth"],
            ["Hepatitis B", "Birth dose", "Liver disease (Hepatitis B)", "Give within 24 hours of birth"],
            ["OPV", "0 (birth dose)", "Polio", "Oral drops"],
        ],
    },
    {
        key: "6w",
        age: "6 weeks (1½ months)",
        unit: "week",
        from: 6,
        to: 6,
        doses: [
            ["DTwP/DTaP", "1", "Diphtheria, whooping cough (pertussis), tetanus", ""],
            ["IPV", "1", "Polio", "Injectable"],
            ["Hib", "1", "Haemophilus influenzae type b", ""],
            ["Hepatitis B", "2", "Liver disease (Hepatitis B)", ""],
            ["PCV", "1", "Pneumonia", ""],
            ["Rotavirus (RVV)", "1", "Diarrhoea (rotavirus)", "Oral drops"],
        ],
    },
    {
        key: "10w",
        age: "10 weeks (2½ months)",
        unit: "week",
        from: 10,
        to: 10,
        doses: [
            ["DTwP/DTaP", "2", "Diphtheria, whooping cough (pertussis), tetanus", ""],
            ["IPV", "2", "Polio", "Injectable"],
            ["Hib", "2", "Haemophilus influenzae type b", ""],
            ["PCV", "2", "Pneumonia", ""],
            ["Rotavirus (RVV)", "2", "Diarrhoea (rotavirus)", "Oral drops"],
        ],
    },
    {
        key: "14w",
        age: "14 weeks (3½ months)",
        unit: "week",
        from: 14,
        to: 14,
        doses: [
            ["DTwP/DTaP", "3", "Diphtheria, whooping cough (pertussis), tetanus", ""],
            ["IPV", "3", "Polio", "Injectable"],
            ["Hib", "3", "Haemophilus influenzae type b", ""],
            ["PCV", "3", "Pneumonia", ""],
            ["Rotavirus (RVV)", "3", "Diarrhoea (rotavirus)", "Oral drops"],
        ],
    },
    {
        key: "6m",
        age: "6 months",
        unit: "month",
        from: 6,
        to: 6,
        doses: [
            ["Hepatitis B", "3", "Liver disease (Hepatitis B)", ""],
            ["Influenza", "1", "Flu (influenza)", "Yearly after the first two doses"],
        ],
    },
    {
        key: "9m",
        age: "9 months",
        unit: "month",
        from: 9,
        to: 9,
        doses: [
            ["MMR", "1", "Measles, mumps, rubella", ""],
            ["Influenza", "2", "Flu (influenza)", "Four weeks after the first dose"],
        ],
    },
    {
        key: "12m",
        age: "12 months",
        unit: "month",
        from: 12,
        to: 12,
        doses: [["Hepatitis A", "1", "Liver disease (Hepatitis A)", ""]],
    },
    {
        key: "15m",
        age: "15 months",
        unit: "month",
        from: 15,
        to: 15,
        doses: [
            ["MMR", "2", "Measles, mumps, rubella", ""],
            ["Varicella", "1", "Chickenpox (varicella)", ""],
            ["PCV", "Booster", "Pneumonia", ""],
        ],
    },
    {
        key: "18m",
        age: "18 months",
        unit: "month",
        from: 18,
        to: 18,
        doses: [
            ["DTwP/DTaP", "Booster-1", "Diphtheria, whooping cough (pertussis), tetanus", ""],
            ["IPV", "Booster", "Polio", "Injectable"],
            ["Hib", "Booster", "Haemophilus influenzae type b", ""],
            ["Hepatitis A", "2", "Liver disease (Hepatitis A)", ""],
        ],
    },
];

const slug = (text) =>
    String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

/**
 * What a dose cell means, as a kind the app can label and a suffix for the key.
 *
 * The card writes the same idea five ways — "Single dose", "0 (birth dose)", "Birth dose",
 * a bare number, "Booster", "Booster-1", "1st dose" — and two of those are the *same* dose
 * written differently (OPV's "0 (birth dose)" and Hepatitis B's "Birth dose"). Parsing them
 * into a kind rather than carrying the printed string is what lets a key be stable and the
 * label be translated; "1st dose" and "1" must not become two different doses of Vitamin A
 * depending on which row a future edit touches.
 *
 * Throws on anything it does not recognise, because the alternative is a key built from a
 * string nobody checked.
 */
const parseDose = (raw) => {
    const text = String(raw ?? "").trim();
    if (!text) throw new Error("Empty dose cell");

    if (/^single/i.test(text)) return { kind: "single", suffix: "" };
    if (/birth/i.test(text)) return { kind: "birth", suffix: "birth" };

    const booster = text.match(/^booster(?:[-\s]?(\d+))?$/i);
    if (booster) {
        return booster[1]
            ? { kind: "booster", number: Number(booster[1]), suffix: `booster_${booster[1]}` }
            : { kind: "booster", suffix: "booster" };
    }

    // "1", 3, "1st dose", "2nd dose" — all the same thing, a numbered dose.
    const numbered = text.match(/^(\d+)(?:\.0)?(?:\s*(?:st|nd|rd|th)\s+dose)?$/i);
    if (numbered) {
        return { kind: "number", number: Number(numbered[1]), suffix: numbered[1] };
    }

    throw new Error(`Unrecognised dose "${text}" — teach parseDose about it`);
};

/**
 * The card prints "PCV booster" as a vaccine and "Booster" as its dose, which would key as
 * `pcv_booster_booster`. The dose column already carries that, so it comes off the name.
 */
const normaliseVaccine = (name, dose) =>
    dose.kind === "booster" ? String(name).replace(/\s+booster$/i, "").trim() : String(name).trim();

/**
 * Short chip label and the longer line under it, split on the card's own parenthesis.
 *
 * "6 weeks (1½ months)" is two facts — the card prints both because the visit is known by
 * both names — but a chip that carries both scrolls the tab strip off the screen. The short
 * half names the chip, the detail half sits on the visit card.
 */
const splitAge = (age) => {
    const match = age.match(/^(.*?)\s*\((.+)\)\s*$/);
    return match ? { short: match[1].trim(), detail: match[2].trim() } : { short: age, detail: null };
};

const header = (what, sha, counts) =>
    `/**
 * GENERATED — do not edit by hand.
 *
 * Source:     content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx (sheet "Vaccinations")
 *             plus the IAP table in scripts/generate-vaccination-schedule.mjs, which the
 *             workbook does not carry and which is NOT clinically reviewed.
 * sha256:     ${sha}
 * Content:    India Mother and Child Protection (MCP) Card, 2018 Version.
 *             Ministry of Health & Family Welfare · Ministry of Women & Child Development.
 * Counts:     ${counts}
 * Regenerate: node scripts/generate-vaccination-schedule.mjs
 *
 * ${what}
 */`;

async function main() {
    const buffer = await readFile(SOURCE);
    const sha = createHash("sha256").update(buffer).digest("hex");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Vaccinations");
    if (!sheet) throw new Error('Workbook has no "Vaccinations" sheet — wrong file?');

    // Guard the shape rather than trusting row positions: a re-exported workbook with an
    // extra title row would otherwise silently produce a schedule off by one.
    const headerRow = sheet.getRow(2);
    const ageHeader = String(headerRow.getCell(1).value ?? "").trim();
    if (ageHeader !== "Age / Visit") {
        throw new Error(`Expected "Age / Visit" in the header row, found "${ageHeader}"`);
    }

    /**
     * One entry per dose key, shared by both schedules.
     *
     * A dose key identifies the dose, not the schedule it appears on — BCG at birth is BCG
     * at birth whichever sector a family attends, and both lists reach it through the same
     * key. That is deliberate: a family that switches sector keeps the ticks that genuinely
     * carry over, and the ones that do not carry over are the ones whose products differ
     * (three doses of Pentavalent are not three doses of DTwP + Hib + Hepatitis B, and
     * mapping them is a clinical question rather than a data one).
     *
     * Which is exactly why this map also checks: the same key appearing twice with different
     * text would mean two different things had collapsed into one database row.
     */
    const doses = new Map();
    const visitLabels = new Map();

    const addDose = (rawName, rawDose, protects, note) => {
        const parsed = parseDose(rawDose);
        const name = normaliseVaccine(rawName, parsed);
        const key = [slug(name), parsed.suffix].filter(Boolean).join("_");

        // The card records Vitamin A in the immunisation section and then says in the notes
        // that it is not a vaccine. Carrying that as a flag rather than as a sentence lets
        // the screen say so in the reader's own language, and keeps the note column for
        // things the note column is actually for.
        const supplement = /^supplement/i.test(note ?? "");
        const cleanNote = supplement ? "" : String(note ?? "").trim();

        const entry = { key, name, protects: String(protects).trim(), note: cleanNote, supplement };
        if (parsed.number !== undefined) entry.number = parsed.number;
        entry.kind = parsed.kind;

        const existing = doses.get(key);
        if (existing) {
            const differs = ["name", "protects", "kind", "number", "supplement"].find(
                (field) => existing[field] !== entry[field],
            );
            // A note present on one schedule and absent on the other is not a conflict —
            // the card annotates rows the IAP table has no reason to. First one wins.
            if (differs) {
                throw new Error(
                    `Dose key "${key}" means two things (${differs}):\n` +
                        `  ${JSON.stringify(existing)}\n  ${JSON.stringify(entry)}`,
                );
            }
            if (!existing.note && cleanNote) existing.note = cleanNote;
            return key;
        }

        doses.set(key, entry);
        return key;
    };

    const noteVisit = (key, age, unit, from, to) => {
        const { short, detail } = splitAge(age);
        const existing = visitLabels.get(key);
        if (existing) {
            if (existing.short !== short || existing.detail !== detail) {
                throw new Error(`Visit "${key}" is labelled two ways: "${existing.short}" / "${short}"`);
            }
            return;
        }
        visitLabels.set(key, { short, detail, unit, from, to });
    };

    // ── The government schedule, from the sheet ──────────────────────────────────────
    const publicVisits = [];

    sheet.eachRow((row, index) => {
        if (index <= 2) return;

        const age = String(row.getCell(1).value ?? "").replace(/\s+/g, " ").trim();
        if (!age) return;

        const visit = VISITS.find((candidate) => candidate.match === age);
        if (!visit) throw new Error(`Unrecognised visit age "${age}" — add it to VISITS`);
        if (visit.exclude) return;

        noteVisit(visit.key, age, visit.unit, visit.from, visit.to);

        const key = addDose(
            row.getCell(2).value,
            row.getCell(3).value,
            row.getCell(4).value,
            row.getCell(5).value,
        );

        let bucket = publicVisits.find((candidate) => candidate.key === visit.key);
        if (!bucket) {
            bucket = { key: visit.key, doses: [] };
            publicVisits.push(bucket);
        }
        bucket.doses.push(key);
    });

    if (!publicVisits.length) throw new Error("Parsed no visits — the sheet layout changed");

    // ── The private schedule, from the table above ───────────────────────────────────
    const privateVisits = IAP.map((visit) => {
        noteVisit(visit.key, visit.age, visit.unit, visit.from, visit.to);
        return {
            key: visit.key,
            doses: visit.doses.map(([name, dose, protects, note]) =>
                addDose(name, dose, protects, note),
            ),
        };
    });

    /**
     * Key order: the government schedule first, then whatever the private one adds.
     *
     * Deterministic so that a regeneration produces an empty diff, and in reading order so
     * that the emitted list is reviewable against the card rather than being an alphabetised
     * pile.
     */
    /**
     * The dose keys each schedule actually contains.
     *
     * Emitted per sector, not only as one flat list, because a child's schedule is fixed at
     * onboarding and can never be switched: a dose may only be recorded against the schedule
     * that child is on. The API has to be able to check that, and it can only do so if it is
     * told which keys belong to which sector.
     *
     * The nine keys the two schedules share — BCG at birth is BCG at birth — appear in both
     * lists, which is what makes the check a plain membership test rather than a special case.
     */
    const keysBySector = { public: [], private: [] };
    for (const [sector, visits] of [
        ["public", publicVisits],
        ["private", privateVisits],
    ]) {
        for (const visit of visits) {
            for (const key of visit.doses) {
                if (!keysBySector[sector].includes(key)) keysBySector[sector].push(key);
            }
        }
    }

    const orderedKeys = [];
    for (const visit of [...publicVisits, ...privateVisits]) {
        for (const key of visit.doses) {
            if (!orderedKeys.includes(key)) orderedKeys.push(key);
        }
    }

    const counts =
        `${publicVisits.length} government visits, ${privateVisits.length} private visits, ` +
        `${orderedKeys.length} doses`;

    /**
     * One line per dose, so the emitted list can be read straight down against the card.
     *
     * The i18n paths are not emitted. A dose carries its key and the screen builds
     * `infant.vaccination.protects.<key>` from it, exactly as a milestone card builds
     * `infant.milestone.items.<key>` — the prefix is a constant, and writing it 48 times
     * would bury the three fields that actually vary. `note` is a flag rather than a path
     * because without it the screen cannot tell an absent note from a missing translation.
     */
    const doseSource = (key) => {
        const dose = doses.get(key);
        const fields = [`key: "${dose.key}"`, `name: ${JSON.stringify(dose.name)}`, `doseKind: "${dose.kind}"`];
        if (dose.number !== undefined) fields.push(`doseNumber: ${dose.number}`);
        if (dose.note) fields.push("note: true");
        if (dose.supplement) fields.push("supplement: true");
        return `            { ${fields.join(", ")} },`;
    };

    const visitSource = (visit) => {
        const label = visitLabels.get(visit.key);
        const detail = label.detail
            ? `\n        detailKey: "infant.vaccination.visitDetail.${visit.key}",`
            : "";
        return `    {
        key: "${visit.key}",
        labelKey: "infant.vaccination.visits.${visit.key}",${detail}
        due: { unit: "${label.unit}", from: ${label.from}, to: ${label.to} },
        doses: [
${visit.doses.map(doseSource).join("\n")}
        ],
    },`;
    };

    // ── apps/mobile/src/data/infantVaccinationData.ts ────────────────────────────────
    const mobile = `${header(
        "Vaccine names are the proper nouns printed on the card the clinic hands over, so they\n * are literals here and are never translated — a Hindi rendering would stop matching the\n * document a mother is holding. Everything a reader *reads* is a key: what the dose protects\n * against, the note under it, and the visit label all live in the locale files.",
        sha,
        counts,
    )}
import { IVaccinationVisit, TVaccinationSector } from "../types/infantLog.types";

/** The government schedule (UIP / NIS), exactly as printed on the MCP card. */
export const MCP_VACCINATION_VISITS: IVaccinationVisit[] = [
${publicVisits.map(visitSource).join("\n")}
];

/** The private paediatrician (IAP) schedule. NOT clinically reviewed — see the generator. */
export const IAP_VACCINATION_VISITS: IVaccinationVisit[] = [
${privateVisits.map(visitSource).join("\n")}
];

/** Which schedule a family follows, chosen at baby onboarding and stored on the child. */
export const VACCINATION_SCHEDULE: Record<TVaccinationSector, IVaccinationVisit[]> = {
    public: MCP_VACCINATION_VISITS,
    private: IAP_VACCINATION_VISITS,
};

/**
 * Every dose key, government schedule first. The catalogue the API validates against.
 *
 * One key space across both schedules: a key names the dose, not the sector it was given
 * in, so the doses the two schedules share are the same row in the database.
 */
export const VACCINE_KEYS: string[] = [
${orderedKeys.map((key) => `    "${key}",`).join("\n")}
];
`;

    // ── services/backend/src/constants/vaccine-keys.ts ───────────────────────────────
    const backend = `${header(
        "The API validates `vaccineKey` against this list, so a stale or tampered client cannot\n * store a row that no screen can ever render. Mirrors VACCINE_KEYS in\n * apps/mobile/src/data/infantVaccinationData.ts — both are emitted from the same run, which\n * is what keeps them from drifting.",
        sha,
        counts,
    )}
export const VACCINE_KEYS = [
${orderedKeys.map((key) => `    "${key}",`).join("\n")}
] as const;

export type VaccineKey = (typeof VACCINE_KEYS)[number];

export const isVaccineKey = (value: unknown): value is VaccineKey =>
    typeof value === "string" && (VACCINE_KEYS as readonly string[]).includes(value);

/**
 * Which doses belong to which schedule.
 *
 * A child's sector is chosen at baby onboarding and is fixed for life, so a dose may only be
 * recorded against the schedule that child is actually on. VACCINE_KEYS above answers "is
 * this a real dose"; this answers "is this a real dose *for this child*", which is the
 * question the write path has to ask.
 *
 * The overlap is deliberate and not a mistake to be deduplicated: ${
     keysBySector.public.filter((key) => keysBySector.private.includes(key)).length
 } keys appear in both
 * lists because both schedules genuinely give those doses.
 */
export const VACCINE_KEYS_BY_SECTOR = {
    public: [
${keysBySector.public.map((key) => `        "${key}",`).join("\n")}
    ],
    private: [
${keysBySector.private.map((key) => `        "${key}",`).join("\n")}
    ],
} as const;

export type VaccinationSector = keyof typeof VACCINE_KEYS_BY_SECTOR;

/** Whether this dose exists on the schedule the child is on. */
export const isVaccineKeyForSector = (value: unknown, sector: VaccinationSector): boolean =>
    typeof value === "string" &&
    (VACCINE_KEYS_BY_SECTOR[sector] as readonly string[]).includes(value);
`;

    // ── scripts/out/vaccination-en.json ──────────────────────────────────────────────
    const en = {
        visits: Object.fromEntries([...visitLabels].map(([key, label]) => [key, label.short])),
        visitDetail: Object.fromEntries(
            [...visitLabels].filter(([, l]) => l.detail).map(([key, l]) => [key, l.detail]),
        ),
        protects: Object.fromEntries(orderedKeys.map((key) => [key, doses.get(key).protects])),
        notes: Object.fromEntries(
            orderedKeys.filter((key) => doses.get(key).note).map((key) => [key, doses.get(key).note]),
        ),
    };

    await mkdir(path.join(ROOT, "scripts/out"), { recursive: true });
    await writeFile(path.join(ROOT, "apps/mobile/src/data/infantVaccinationData.ts"), mobile);
    await writeFile(path.join(ROOT, "services/backend/src/constants/vaccine-keys.ts"), backend);
    await writeFile(
        path.join(ROOT, "scripts/out/vaccination-en.json"),
        `${JSON.stringify(en, null, 2)}\n`,
    );

    console.log(`Generated ${counts}`);
    for (const visit of publicVisits) {
        console.log(`  public  ${visit.key.padEnd(8)} ${visit.doses.join(", ")}`);
    }
    for (const visit of privateVisits) {
        console.log(`  private ${visit.key.padEnd(8)} ${visit.doses.join(", ")}`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
