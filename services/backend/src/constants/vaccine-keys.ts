/**
 * GENERATED — do not edit by hand.
 *
 * Source:     content/mcp-card/VivaMama_Vaccinations_and_Milestones.xlsx (sheet "Vaccinations")
 *             plus the IAP table in scripts/generate-vaccination-schedule.mjs, which the
 *             workbook does not carry and which is NOT clinically reviewed.
 * sha256:     49480011db00a6d5446a0f1f8c1fe217d9868f72563893293cfbeb16e92e7450
 * Content:    India Mother and Child Protection (MCP) Card, 2018 Version.
 *             Ministry of Health & Family Welfare · Ministry of Women & Child Development.
 * Counts:     6 government visits, 9 private visits, 48 doses
 * Regenerate: node scripts/generate-vaccination-schedule.mjs
 *
 * The API validates `vaccineKey` against this list, so a stale or tampered client cannot
 * store a row that no screen can ever render. Mirrors VACCINE_KEYS in
 * apps/mobile/src/data/infantVaccinationData.ts — both are emitted from the same run, which
 * is what keeps them from drifting.
 */
export const VACCINE_KEYS = [
    "bcg",
    "opv_birth",
    "hepatitis_b_birth",
    "pentavalent_1",
    "opv_1",
    "rotavirus_rvv_1",
    "pcv_1",
    "fipv_ipv_1",
    "pentavalent_2",
    "opv_2",
    "rotavirus_rvv_2",
    "pentavalent_3",
    "opv_3",
    "rotavirus_rvv_3",
    "pcv_2",
    "fipv_ipv_2",
    "measles_rubella_mr_1",
    "je_1",
    "pcv_booster",
    "fipv_ipv_3",
    "vitamin_a_1",
    "dpt_booster_1",
    "opv_booster",
    "measles_rubella_mr_2",
    "je_2",
    "vitamin_a_2",
    "dtwp_dtap_1",
    "ipv_1",
    "hib_1",
    "hepatitis_b_2",
    "dtwp_dtap_2",
    "ipv_2",
    "hib_2",
    "dtwp_dtap_3",
    "ipv_3",
    "hib_3",
    "pcv_3",
    "hepatitis_b_3",
    "influenza_1",
    "mmr_1",
    "influenza_2",
    "hepatitis_a_1",
    "mmr_2",
    "varicella_1",
    "dtwp_dtap_booster_1",
    "ipv_booster",
    "hib_booster",
    "hepatitis_a_2",
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
 * The overlap is deliberate and not a mistake to be deduplicated: 9 keys appear in both
 * lists because both schedules genuinely give those doses.
 */
export const VACCINE_KEYS_BY_SECTOR = {
    public: [
        "bcg",
        "opv_birth",
        "hepatitis_b_birth",
        "pentavalent_1",
        "opv_1",
        "rotavirus_rvv_1",
        "pcv_1",
        "fipv_ipv_1",
        "pentavalent_2",
        "opv_2",
        "rotavirus_rvv_2",
        "pentavalent_3",
        "opv_3",
        "rotavirus_rvv_3",
        "pcv_2",
        "fipv_ipv_2",
        "measles_rubella_mr_1",
        "je_1",
        "pcv_booster",
        "fipv_ipv_3",
        "vitamin_a_1",
        "dpt_booster_1",
        "opv_booster",
        "measles_rubella_mr_2",
        "je_2",
        "vitamin_a_2",
    ],
    private: [
        "bcg",
        "hepatitis_b_birth",
        "opv_birth",
        "dtwp_dtap_1",
        "ipv_1",
        "hib_1",
        "hepatitis_b_2",
        "pcv_1",
        "rotavirus_rvv_1",
        "dtwp_dtap_2",
        "ipv_2",
        "hib_2",
        "pcv_2",
        "rotavirus_rvv_2",
        "dtwp_dtap_3",
        "ipv_3",
        "hib_3",
        "pcv_3",
        "rotavirus_rvv_3",
        "hepatitis_b_3",
        "influenza_1",
        "mmr_1",
        "influenza_2",
        "hepatitis_a_1",
        "mmr_2",
        "varicella_1",
        "pcv_booster",
        "dtwp_dtap_booster_1",
        "ipv_booster",
        "hib_booster",
        "hepatitis_a_2",
    ],
} as const;

export type VaccinationSector = keyof typeof VACCINE_KEYS_BY_SECTOR;

/** Whether this dose exists on the schedule the child is on. */
export const isVaccineKeyForSector = (value: unknown, sector: VaccinationSector): boolean =>
    typeof value === "string" &&
    (VACCINE_KEYS_BY_SECTOR[sector] as readonly string[]).includes(value);
