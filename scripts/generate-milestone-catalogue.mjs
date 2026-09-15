/**
 * Converts the MCP card's Milestones sheet into source the app and the API both read from.
 *
 * Run:  node scripts/generate-milestone-catalogue.mjs
 *
 * Why this exists rather than a hand-typed list: the content is transcribed from a
 * government publication (India Mother and Child Protection Card, 2018), and the milestone
 * keys are primary keys in the database. Being able to re-run this and get an empty
 * `git diff` is the audit trail — the same argument made for the WHO LMS tables in
 * packages/growth-standards/scripts/generate-tables.ts.
 *
 * Why plain ESM rather than TypeScript, unlike that generator: this one imports no types
 * from the packages it writes into, so a tsconfig and a ts-node invocation would buy
 * nothing. `exceljs` resolves from the repo root because .npmrc pins node-linker=hoisted,
 * which puts every workspace dependency in the root node_modules by design.
 *
 * Emits three files; all three are generated and must not be hand-edited:
 *   apps/mobile/src/data/infantMilestoneData.ts      bands, keys, i18n key names
 *   services/backend/src/constants/milestone-keys.ts the key list, for request validation
 *   scripts/out/milestone-en.json                    English copy, merged into en.json
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx");

/**
 * Band keys are written by hand rather than slugged from the age label.
 *
 * The labels carry en-dashes and parentheses ("24 months (2 years)") that would slug into
 * something unreadable, and these keys appear in URLs and stored rows — they should be
 * chosen, not derived. The `age` here is the label shown on the chip.
 *
 * `from`/`to` are the band's range in whole months, written out rather than parsed back off
 * the key. The screen opens on the band a child is actually in, and deriving "18m" → 18..18
 * but "2-3m" → 2..3 from the key string would make the chip label load-bearing — rename a
 * key and the screen quietly opens somewhere else.
 */
const BANDS = [
    { match: "2–3 months", key: "2-3m", from: 2, to: 3 },
    { match: "4–6 months", key: "4-6m", from: 4, to: 6 },
    { match: "7–9 months", key: "7-9m", from: 7, to: 9 },
    { match: "10–12 months", key: "10-12m", from: 10, to: 12 },
    { match: "18 months", key: "18m", from: 18, to: 18 },
    { match: "24 months (2 years)", key: "24m", from: 24, to: 24 },
    {
        match: "3 years",
        key: "3y",
        from: 36,
        to: 36,
        /**
         * Transcribed from the card and deliberately not shipped.
         *
         * Kept here rather than deleted so the sheet still parses: the loop below throws on
         * an age it does not recognise, which is what stops a re-exported workbook silently
         * dropping a band. An excluded band is a decision recorded in the code; a missing one
         * would be indistinguishable from a mistake.
         *
         * Removing this flag is all it takes to ship the band — the content is still in the
         * workbook and still comes through the parser.
         */
        exclude: true,
    },
];

/**
 * A stable key from the English sentence.
 *
 * Deliberately readable rather than short: these appear in the database, in API payloads and
 * in i18n keys, and `begins_to_recognize_the_mothers_face` tells a reader what row they are
 * looking at where `m_2_3_01` would not. Positional keys were the alternative and are worse:
 * inserting a milestone would silently renumber every row after it.
 */
const TAIL_NOISE = new Set([
    "a", "an", "the", "and", "or", "in", "on", "to", "for", "of", "with", "as", "such",
    "that", "when", "like", "his", "her", "their", "its", "it", "you", "they", "is",
    "are", "be", "by", "at", "from", "into", "etc",
]);

const slug = (text) => {
    const words = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .split("_")
        .filter(Boolean);

    const kept = [];
    for (const word of words) {
        if ([...kept, word].join("_").length > 60) break;
        kept.push(word);
    }

    // Truncating on a word boundary alone leaves dangling joiners — "…pictures_in_a",
    // "…activities_shows_for". These are primary keys in the database and read badly in a
    // payload, so trailing filler comes off after the cut.
    while (kept.length > 1 && TAIL_NOISE.has(kept[kept.length - 1])) kept.pop();

    return kept.join("_");
};

/** The sheet separates list items with "•". Quotes and dashes are left exactly as printed. */
const bullets = (cell) =>
    String(cell ?? "")
        .split("•")
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter(Boolean);

const header = (what, sha, counts) =>
    `/**
 * GENERATED — do not edit by hand.
 *
 * Source:     content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx (sheet "Milestones")
 * sha256:     ${sha}
 * Content:    India Mother and Child Protection (MCP) Card, 2018 Version.
 *             Ministry of Health & Family Welfare · Ministry of Women & Child Development.
 * Counts:     ${counts}
 * Regenerate: node scripts/generate-milestone-catalogue.mjs
 *
 * ${what}
 */`;

async function main() {
    const buffer = await readFile(SOURCE);
    const sha = createHash("sha256").update(buffer).digest("hex");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Milestones");
    if (!sheet) throw new Error('Workbook has no "Milestones" sheet — wrong file?');

    // Guard the shape rather than trusting row positions: a re-exported workbook with an
    // extra title row would otherwise silently produce a catalogue off by one.
    const headerRow = sheet.getRow(2);
    const ageHeader = String(headerRow.getCell(1).value ?? "").trim();
    if (ageHeader !== "Age") {
        throw new Error(`Expected "Age" in B2-row column A, found "${ageHeader}"`);
    }

    const bands = [];
    const seen = new Map();

    sheet.eachRow((row, index) => {
        if (index <= 2) return;

        const age = String(row.getCell(1).value ?? "").replace(/\s+/g, " ").trim();
        if (!age) return;

        const band = BANDS.find((candidate) => candidate.match === age);
        if (!band) throw new Error(`Unrecognised age band "${age}" — add it to BANDS`);

        // Recognised, read, and then dropped. Skipping before `build` runs also keeps the
        // excluded band's keys out of `seen`, so a collision between a shipped milestone and
        // one that is never shipped cannot fail the build.
        if (band.exclude) return;

        const build = (text) => {
            const key = slug(text);
            const previous = seen.get(key);
            // Fail loudly. A silent dedupe would drop a milestone from the app, and a
            // silent rename would orphan every row already stored against the old key.
            if (previous && previous !== text) {
                throw new Error(`Key collision "${key}":\n  ${previous}\n  ${text}`);
            }
            seen.set(key, text);
            return { key, text };
        };

        bands.push({
            key: band.key,
            from: band.from,
            to: band.to,
            age,
            milestones: bullets(row.getCell(2).value).map(build),
            warnings: bullets(row.getCell(3).value).map(build),
        });
    });

    const milestoneCount = bands.reduce((n, b) => n + b.milestones.length, 0);
    const warningCount = bands.reduce((n, b) => n + b.warnings.length, 0);
    const counts = `${bands.length} bands, ${milestoneCount} milestones, ${warningCount} warning signs`;

    // ── apps/mobile/src/data/infantMilestoneData.ts ──────────────────────────────────
    const bandSource = bands
        .map(
            (band) => `    {
        key: "${band.key}",
        labelKey: "infant.milestone.bands.${band.key}",
        ageMonths: { from: ${band.from}, to: ${band.to} },
        milestones: [
${band.milestones.map((m) => `            "${m.key}",`).join("\n")}
        ],
        warnings: [
${band.warnings.map((w) => `            "${w.key}",`).join("\n")}
        ],
    },`,
        )
        .join("\n");

    const mobile = `${header(
        "Milestone keys only. The words a parent reads live in the locale files, keyed\n * `infant.milestone.items.<key>` and `infant.milestone.warnings.<key>`, so that Hindi is a\n * translation rather than a second transcription of the card.",
        sha,
        counts,
    )}
import { IMilestoneBand } from "../types/infantLog.types";

export const MILESTONE_BANDS: IMilestoneBand[] = [
${bandSource}
];

/** Every milestone key, in card order. The catalogue the API validates against. */
export const MILESTONE_KEYS: string[] = [
${bands.flatMap((b) => b.milestones).map((m) => `    "${m.key}",`).join("\n")}
];
`;

    // ── services/backend/src/constants/milestone-keys.ts ─────────────────────────────
    const backend = `${header(
        "The API validates `milestoneKey` against this list, so a stale or tampered client\n * cannot store a row that no screen can ever render. Mirrors MILESTONE_KEYS in\n * apps/mobile/src/data/infantMilestoneData.ts — both are emitted from the same sheet in\n * the same run, which is what keeps them from drifting.",
        sha,
        counts,
    )}
export const MILESTONE_KEYS = [
${bands.flatMap((b) => b.milestones).map((m) => `    "${m.key}",`).join("\n")}
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export const isMilestoneKey = (value: unknown): value is MilestoneKey =>
    typeof value === "string" && (MILESTONE_KEYS as readonly string[]).includes(value);
`;

    // ── scripts/out/milestone-en.json ────────────────────────────────────────────────
    const en = {
        bands: Object.fromEntries(bands.map((b) => [b.key, b.age])),
        items: Object.fromEntries(bands.flatMap((b) => b.milestones).map((m) => [m.key, m.text])),
        warnings: Object.fromEntries(bands.flatMap((b) => b.warnings).map((w) => [w.key, w.text])),
    };

    await mkdir(path.join(ROOT, "scripts/out"), { recursive: true });
    await writeFile(path.join(ROOT, "apps/mobile/src/data/infantMilestoneData.ts"), mobile);
    await writeFile(path.join(ROOT, "services/backend/src/constants/milestone-keys.ts"), backend);
    await writeFile(path.join(ROOT, "scripts/out/milestone-en.json"), `${JSON.stringify(en, null, 2)}\n`);

    console.log(`Generated ${counts}`);
    for (const band of bands) {
        console.log(`  ${band.key.padEnd(8)} ${String(band.milestones.length).padStart(2)} milestones, ${String(band.warnings.length).padStart(2)} warnings   (${band.age})`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
