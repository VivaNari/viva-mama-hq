/**
 * Converts the Journey content workbook into the data the Journey tab reads.
 *
 * Run:  node scripts/generate-journey-content.mjs
 *
 * Why generated: the workbook is the clinically reviewed source, and re-running this to an
 * empty `git diff` is the audit trail that the app says what the workbook says. It follows
 * scripts/generate-milestone-catalogue.mjs.
 *
 * Emits two files, both generated and not to be hand-edited:
 *   apps/mobile/src/data/journey/journeyRows.ts          when each row shows, its help set,
 *                                                        what each Card 3 tile opens
 *   apps/mobile/src/i18n/locales/journey/en.json         the words, by row id
 *
 * Hindi lives beside en.json in hi.json and is not touched here, because the workbook is
 * English only. hi.json is a draft awaiting clinical review. After a workbook change, add
 * any new or reworded line to it; until then that line shows in English.
 *
 * Left out on purpose: Wellness check-in, Ask Viva prompt and Milestone, which this screen
 * does not use; Mother's Card 2, because Coming up reads from the ANC and PNC schedules; and
 * Health worker visit, which the workbook says is never shown in the app.
 *
 * Fails rather than guesses. A row with an unknown help set or a Card 3 line no rule can
 * route stops the run, so new copy cannot silently lose its link or its safety list.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "content/journey/VivaMama_Journey_Screen_Content_1000_days.xlsx");
const ROWS_OUT = path.join(ROOT, "apps/mobile/src/data/journey/journeyRows.ts");
const COPY_OUT = path.join(ROOT, "apps/mobile/src/i18n/locales/journey/en.json");

const DAYS_PER_MONTH = 30.4375;

const STAGES = {
    Pregnancy: "pregnancy",
    Delivery: "delivery",
    "Acute postpartum": "acutePostpartum",
    "Late postpartum": "latePostpartum",
    Motherhood: "motherhood",
};

const HELP_SETS = {
    "Pregnancy, early": "pregnancyEarly",
    "Pregnancy, late": "pregnancyLate",
    Postpartum: "postpartum",
    "Mother, later": "motherLater",
    Newborn: "newborn",
    Child: "child",
};

/** First match wins, so "Take your MCP card" is listed before "Take <a tablet>". */
const MOTHER_ACTIONS = [
    [/^Take your MCP card/, "tick"],
    [/^(Tell|Ask) your ASHA/, "tick"],
    [/^Take /, "medicine"],
    [/^Reminder:/, "reminders"],
    [/^Set /, "reminders"],
    [/^Log your mood/, "mood"],
    [/^Wellness check-in/, "mood"],
    [/^Log (baby moved|10 kicks)/, "kicks"],
    // No mother log exists for these yet, so Viva takes them in chat.
    [/^Log (the first feed|when tightenings start)/, "chat"],
    [/^Ask Viva/, "chat"],
    [/^Upload /, "records"],
    [/^Share /, "summary"],
    [/^Read:/, "library"],
    [/^Book /, "experts"],
    [/^Call 102 or 108/, "call"],
];

/** From the birth, Baby's Card 3 opens the child log it names. */
const BABY_ACTIONS = [
    [/vaccine/i, "vaccination"],
    [/^Log (feeds|the first feed|first foods)/, "feeding"],
    [/^Log (the )?weight/, "growth"],
    [/^Log /, "milestone"],
];

const fail = (message) => {
    throw new Error(`generate-journey-content: ${message}`);
};

const text = (row, column) => {
    const value = row.getCell(column).value;
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && value.richText) {
        return value.richText.map((part) => part.text).join("").trim();
    }
    return String(value).trim();
};

const required = (row, column, id) => text(row, column) || fail(`${id} has no column ${column}`);

const list = (cell) =>
    cell
        .split(/\s*[/\n]\s*/)
        .map((item) => item.trim())
        .filter(Boolean);

const helpSet = (name, id) => HELP_SETS[name] ?? fail(`${id} names an unknown help set "${name}"`);

const actionFor = (rules, line, id) => {
    const rule = rules.find(([pattern]) => pattern.test(line));
    return rule ? rule[1] : fail(`${id} has a Card 3 line no rule can route: "${line}"`);
};

const dataRows = (sheet) => {
    const rows = [];
    sheet.eachRow((row, number) => {
        if (number > 1 && text(row, "A")) rows.push(row);
    });
    return rows;
};

/** Guard the shape rather than trusting positions: a moved column must stop the run. */
const expectHeaders = (sheet, expected) => {
    const header = sheet.getRow(1);
    for (const [column, title] of Object.entries(expected)) {
        if (!text(header, column).startsWith(title)) {
            fail(`${sheet.name} column ${column} should be "${title}", found "${text(header, column)}"`);
        }
    }
};

/** Days since birth at which a row begins, from its "When" text. */
const dayFromWhen = (when, id) => {
    const weeks = /(\d+) weeks/.exec(when);
    if (weeks) return Number(weeks[1]) * 7;
    const months = /(\d+)(?: to \d+)? months/.exec(when);
    if (months) return Math.round(Number(months[1]) * DAYS_PER_MONTH);
    return fail(`${id} has a "When" this script cannot read: "${when}"`);
};

const motherWhen = (id, when) => {
    let match;
    if ((match = /^M-P(\d+)$/.exec(id))) return { unit: "pregnancyWeek", value: Number(match[1]) };
    if (/^M-D\d$/.test(id)) return { unit: "delivery", value: Number(id.slice(3)) };
    if ((match = /^M-PP(\d+)$/.exec(id))) return { unit: "postpartumWeek", value: Number(match[1]) };
    if (/^M-T/.test(id)) return { unit: "day", value: dayFromWhen(when, id) };
    return fail(`unknown mother row id ${id}`);
};

const babyWhen = (id, when) => {
    let match;
    if ((match = /^B-P(\d+)$/.exec(id))) return { unit: "pregnancyWeek", value: Number(match[1]) };
    if (id === "B-BIRTH") return { unit: "day", value: 0 };
    if ((match = /^B-NB(\d+)$/.exec(id))) return { unit: "postpartumWeek", value: Number(match[1]) };
    return { unit: "day", value: dayFromWhen(when, id) };
};

const buildMother = (sheet) => {
    expectHeaders(sheet, {
        A: "ID",
        B: "Stage",
        C: "When",
        D: "Card 1: Happening (headline)",
        E: "Card 1: Happening (one line)",
        F: "Card 1: Normal chips",
        J: "Card 3 Remember (Govt): reminder",
        K: "Card 3 Remember (Govt): log",
        L: "Card 3 Remember (Govt): record",
        M: "Card 3 Remember (Private): reminder",
        N: "Card 3 Remember (Private): log",
        O: "Card 3 Remember (Private): record",
        P: "Card 1 Learn more: title",
        Q: "Card 1 Learn more (Govt)",
        R: "Card 1 Learn more (Private)",
        V: "Help set",
    });

    const rows = [];
    const copy = {};
    for (const row of dataRows(sheet)) {
        const id = text(row, "A");
        const stage = STAGES[text(row, "B")] ?? fail(`${id} has an unknown stage`);
        const govt = ["J", "K", "L"].map((column) => required(row, column, id));
        const priv = ["M", "N", "O"].map((column) => required(row, column, id));

        rows.push({
            id,
            stage,
            when: motherWhen(id, text(row, "C")),
            helpSet: helpSet(text(row, "V"), id),
            remember: {
                govt: govt.map((line) => actionFor(MOTHER_ACTIONS, line, id)),
                private: priv.map((line) => actionFor(MOTHER_ACTIONS, line, id)),
            },
        });
        copy[id] = {
            happening: {
                headline: required(row, "D", id),
                line: required(row, "E", id),
                chips: list(required(row, "F", id)),
            },
            learnMore: {
                title: required(row, "P", id),
                govt: required(row, "Q", id),
                private: required(row, "R", id),
            },
            remember: { govt, private: priv },
        };
    }
    return { rows, copy };
};

const buildBaby = (sheet) => {
    expectHeaders(sheet, {
        A: "ID",
        B: "Phase",
        C: "When",
        D: "Card 1 title",
        E: "Card 1 text",
        F: "Size",
        G: "Card 2 title",
        H: "Card 2 (Govt",
        I: "Card 2 (Private",
        J: "Card 3 title",
        K: "Card 3 text (Govt",
        L: "Card 3 text (Private",
        M: "Learn more: title",
        N: "Learn more: text",
        O: "Watch for set",
    });

    const rows = [];
    const copy = {};
    for (const row of dataRows(sheet)) {
        const id = text(row, "A");
        const bornYet = !id.startsWith("B-P");
        const govt = required(row, "K", id);
        const priv = required(row, "L", id);

        rows.push({
            id,
            when: babyWhen(id, text(row, "C")),
            helpSet: helpSet(text(row, "O"), id),
            // Before birth Card 3 is something to do together, so it opens nothing.
            log: bornYet
                ? {
                      govt: actionFor(BABY_ACTIONS, govt, id),
                      private: actionFor(BABY_ACTIONS, priv, id),
                  }
                : null,
        });
        copy[id] = {
            card1: { title: required(row, "D", id), text: required(row, "E", id) },
            ...(text(row, "F") ? { size: text(row, "F") } : {}),
            card2: {
                title: required(row, "G", id),
                govt: required(row, "H", id),
                private: required(row, "I", id),
            },
            card3: { title: required(row, "J", id), govt, private: priv },
            ...(text(row, "M") ? { learnMore: { title: text(row, "M"), text: required(row, "N", id) } } : {}),
        };
    }
    return { rows, copy };
};

const buildHelp = (sheet) => {
    expectHeaders(sheet, { A: "Set", B: "Signs", C: "Numbers" });

    const sets = {};
    const numberCells = new Set();
    for (const row of dataRows(sheet)) {
        const name = text(row, "A");
        const key = helpSet(name, `Help sets "${name}"`);
        sets[key] = required(row, "B", name)
            .split(";")
            .map((sign) => sign.trim())
            .filter(Boolean);
        numberCells.add(required(row, "C", name));
    }

    for (const key of Object.values(HELP_SETS)) {
        if (!sets[key]?.length) fail(`help set ${key} has no signs`);
    }
    // One list of numbers on screen, so a set that differs would be silently lost.
    if (numberCells.size !== 1) fail("help sets disagree on their numbers");

    // "Ambulance 108 or 102; Tele MANAS 14416" -> a label with its tap-to-call numbers.
    const numbers = [...numberCells][0].split(";").map((entry) => {
        const dialable = entry.match(/\d{3,}/g) ?? fail(`no number in "${entry}"`);
        const label = entry.replace(/\d{3,}/g, "").replace(/\bor\b/g, "").replace(/\s+/g, " ").trim();
        return { label, dial: dialable };
    });

    return { sets, numbers };
};

const main = async () => {
    const buffer = await readFile(SOURCE);
    const sha = createHash("sha256").update(buffer).digest("hex");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = (name) => workbook.getWorksheet(name) ?? fail(`no "${name}" sheet`);

    const mother = buildMother(sheet("Mother"));
    const baby = buildBaby(sheet("Baby"));
    const help = buildHelp(sheet("Help sets"));

    const rowsFile = `// GENERATED by scripts/generate-journey-content.mjs. Do not edit by hand.
// Source: content/journey/VivaMama_Journey_Screen_Content_1000_days.xlsx
// sha256: ${sha}
// ${mother.rows.length} mother rows, ${baby.rows.length} baby rows.

import { JourneyBabyRow, JourneyMotherRow } from './journeyTypes';

export const MOTHER_ROWS: JourneyMotherRow[] = ${JSON.stringify(mother.rows, null, 2)};

export const BABY_ROWS: JourneyBabyRow[] = ${JSON.stringify(baby.rows, null, 2)};
`;

    await mkdir(path.dirname(ROWS_OUT), { recursive: true });
    await mkdir(path.dirname(COPY_OUT), { recursive: true });
    await writeFile(ROWS_OUT, rowsFile);
    await writeFile(
        COPY_OUT,
        `${JSON.stringify({ mother: mother.copy, baby: baby.copy, help }, null, 2)}\n`,
    );

    console.log(`Wrote ${mother.rows.length} mother and ${baby.rows.length} baby rows (sha256 ${sha.slice(0, 12)})`);
};

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
