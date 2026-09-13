/**
 * Converts WHO's published z-score workbooks into TypeScript source.
 *
 * Run:  pnpm --filter @vivamama/growth-standards run generate
 *
 * Why TypeScript output rather than JSON:
 *   - the backend compiles with `rootDir: src`, and loose JSON assets are easy to leave
 *     out of the emitted build; a .ts file is just another module on both sides;
 *   - Metro needs no asset configuration for it;
 *   - and a .ts file can carry a provenance header. JSON cannot hold a comment, and for a
 *     medical number the provenance is the point.
 *
 * Each generated file records the sha256 of the workbook it came from, so a silently
 * swapped source fails review rather than shipping. Regenerating should always produce an
 * empty `git diff`.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

import ExcelJS from "exceljs";

import { Indicator, KeyKind, LmsRow, Sex } from "../src/types";

interface SourceSpec {
    /** Relative to the source directory. */
    file: string;
    indicator: Indicator;
    sex: Sex;
    keyKind: KeyKind;
    valueUnit: "kg" | "cm";
    /** Header text expected in column A — a cheap guard against a mismatched workbook. */
    keyHeader: "Month" | "Length";
    exportName: string;
    outFile: string;
}

const SOURCES: SourceSpec[] = [
    {
        file: "weight-for-age/wfa_boys_0-to-5-years_zscores.xlsx",
        indicator: "weight_for_age",
        sex: "Male",
        keyKind: "ageMonths",
        valueUnit: "kg",
        keyHeader: "Month",
        exportName: "WEIGHT_FOR_AGE_BOYS",
        outFile: "weight-for-age.boys.ts",
    },
    {
        file: "weight-for-age/wfa_girls_0-to-5-years_zscores.xlsx",
        indicator: "weight_for_age",
        sex: "Female",
        keyKind: "ageMonths",
        valueUnit: "kg",
        keyHeader: "Month",
        exportName: "WEIGHT_FOR_AGE_GIRLS",
        outFile: "weight-for-age.girls.ts",
    },
    {
        file: "length-height-for-age/lhfa_boys_0-to-2-years_zscores.xlsx",
        indicator: "length_for_age",
        sex: "Male",
        keyKind: "ageMonths",
        valueUnit: "cm",
        keyHeader: "Month",
        exportName: "LENGTH_FOR_AGE_BOYS",
        outFile: "length-for-age.boys.ts",
    },
    {
        file: "length-height-for-age/lhfa_girls_0-to-2-years_zscores.xlsx",
        indicator: "length_for_age",
        sex: "Female",
        keyKind: "ageMonths",
        valueUnit: "cm",
        keyHeader: "Month",
        exportName: "LENGTH_FOR_AGE_GIRLS",
        outFile: "length-for-age.girls.ts",
    },
    {
        file: "head-circumference-for-age/hcfa-boys-0-5-zscores.xlsx",
        indicator: "head_circumference_for_age",
        sex: "Male",
        keyKind: "ageMonths",
        valueUnit: "cm",
        keyHeader: "Month",
        exportName: "HEAD_CIRCUMFERENCE_FOR_AGE_BOYS",
        outFile: "head-circumference-for-age.boys.ts",
    },
    {
        file: "head-circumference-for-age/hcfa-girls-0-5-zscores.xlsx",
        indicator: "head_circumference_for_age",
        sex: "Female",
        keyKind: "ageMonths",
        valueUnit: "cm",
        keyHeader: "Month",
        exportName: "HEAD_CIRCUMFERENCE_FOR_AGE_GIRLS",
        outFile: "head-circumference-for-age.girls.ts",
    },
    {
        file: "weight-for-length/wfl_boys_0-to-2-years_zscores.xlsx",
        indicator: "weight_for_length",
        sex: "Male",
        keyKind: "lengthCm",
        valueUnit: "kg",
        keyHeader: "Length",
        exportName: "WEIGHT_FOR_LENGTH_BOYS",
        outFile: "weight-for-length.boys.ts",
    },
    {
        file: "weight-for-length/wfl_girls_0-to-2-years_zscores.xlsx",
        indicator: "weight_for_length",
        sex: "Female",
        keyKind: "lengthCm",
        valueUnit: "kg",
        keyHeader: "Length",
        exportName: "WEIGHT_FOR_LENGTH_GIRLS",
        outFile: "weight-for-length.girls.ts",
    },
];

const SOURCE_DIR =
    process.env.WHO_LMS_DIR ?? path.resolve(__dirname, "..", "who-source");
const OUT_DIR = path.resolve(__dirname, "..", "src", "data");

const cell = (row: ExcelJS.Row, column: number): number | null => {
    const value = row.getCell(column).value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readTable = async (spec: SourceSpec) => {
    const absolute = path.join(SOURCE_DIR, spec.file);

    const sha256 = createHash("sha256").update(await readFile(absolute)).digest("hex");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(absolute);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error(`${spec.file}: no worksheet`);

    // Guard the key column. The four indicators differ mainly in what they are indexed by,
    // so a mismatched workbook would otherwise produce a table that computes cleanly and is
    // silently wrong.
    const header = String(sheet.getRow(1).getCell(1).value ?? "").trim();
    if (header !== spec.keyHeader) {
        throw new Error(
            `${spec.file}: expected column A header "${spec.keyHeader}", found "${header}"`,
        );
    }

    const rows: LmsRow[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const key = cell(row, 1);
        const L = cell(row, 2);
        const M = cell(row, 3);
        const S = cell(row, 4);

        if (key === null || L === null || M === null || S === null) {
            throw new Error(`${spec.file}: row ${rowNumber} has a missing key/L/M/S value`);
        }

        rows.push([key, L, M, S]);
    });

    if (rows.length === 0) throw new Error(`${spec.file}: no data rows`);

    rows.sort((a, b) => a[0] - b[0]);

    const first = rows[0];
    const last = rows[rows.length - 1];
    if (!first || !last) throw new Error(`${spec.file}: could not determine domain`);

    return { sha256, rows, domain: [first[0], last[0]] as const };
};

const render = (
    spec: SourceSpec,
    table: Awaited<ReturnType<typeof readTable>>,
): string => {
    const keyLabel =
        spec.keyKind === "ageMonths"
            ? `Month ${table.domain[0]}..${table.domain[1]}`
            : `Length ${table.domain[0]}..${table.domain[1]} cm`;

    const rows = table.rows
        .map(([key, L, M, S]) => `    [${key}, ${L}, ${M}, ${S}],`)
        .join("\n");

    return `/**
 * GENERATED — do not edit by hand.
 *
 * Source:     who-source/${spec.file}
 * sha256:     ${table.sha256}
 * Rows:       ${table.rows.length} (${keyLabel})
 * Standard:   WHO Child Growth Standards (2006).
 * Regenerate: pnpm --filter @vivamama/growth-standards run generate
 */
import { LmsTable } from "../types";

export const ${spec.exportName}: LmsTable = {
    indicator: "${spec.indicator}",
    sex: "${spec.sex}",
    keyKind: "${spec.keyKind}",
    valueUnit: "${spec.valueUnit}",
    domain: [${table.domain[0]}, ${table.domain[1]}],
    // [key, L, M, S]
    rows: [
${rows}
    ],
};
`;
};

const renderIndex = (specs: SourceSpec[]): string => {
    const imports = specs
        .map((spec) => `import { ${spec.exportName} } from "./${spec.outFile.replace(/\.ts$/, "")}";`)
        .join("\n");

    const entries = specs
        .map((spec) => `    "${spec.indicator}:${spec.sex}": ${spec.exportName},`)
        .join("\n");

    return `/**
 * GENERATED — do not edit by hand.
 * Regenerate: pnpm --filter @vivamama/growth-standards run generate
 */
import { Indicator, LmsTable, Sex } from "../types";

${imports}

export type TableKey = \`\${Indicator}:\${Sex}\`;

/** Every WHO table, addressed by indicator and sex. */
export const TABLES: Readonly<Record<TableKey, LmsTable>> = {
${entries}
};

export const tableFor = (indicator: Indicator, sex: Sex): LmsTable | null =>
    TABLES[\`\${indicator}:\${sex}\`] ?? null;
`;
};

const main = async () => {
    await mkdir(OUT_DIR, { recursive: true });

    for (const spec of SOURCES) {
        const table = await readTable(spec);
        await writeFile(path.join(OUT_DIR, spec.outFile), render(spec, table), "utf8");

        console.log(
            `${spec.outFile.padEnd(38)} ${String(table.rows.length).padStart(3)} rows  ` +
                `[${table.domain[0]}..${table.domain[1]}]  ${table.sha256.slice(0, 12)}`,
        );
    }

    await writeFile(path.join(OUT_DIR, "index.ts"), renderIndex(SOURCES), "utf8");

    console.log(`\nWrote ${SOURCES.length + 1} files to src/data/`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
