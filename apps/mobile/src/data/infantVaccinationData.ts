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
 * Vaccine names are the proper nouns printed on the card the clinic hands over, so they
 * are literals here and are never translated — a Hindi rendering would stop matching the
 * document a mother is holding. Everything a reader *reads* is a key: what the dose protects
 * against, the note under it, and the visit label all live in the locale files.
 */
import { IVaccinationVisit, TVaccinationSector } from "../types/infantLog.types";

/** The government schedule (UIP / NIS), exactly as printed on the MCP card. */
export const MCP_VACCINATION_VISITS: IVaccinationVisit[] = [
    {
        key: "birth",
        labelKey: "infant.vaccination.visits.birth",
        detailKey: "infant.vaccination.visitDetail.birth",
        due: { unit: "week", from: 0, to: 0 },
        doses: [
            { key: "bcg", name: "BCG", vaccine: "bcg", doseKind: "single", note: true },
            { key: "opv_birth", name: "OPV", vaccine: "opv", doseKind: "birth", note: true },
            { key: "hepatitis_b_birth", name: "Hepatitis B", vaccine: "hepatitis_b", doseKind: "birth", note: true },
        ],
    },
    {
        key: "6w",
        labelKey: "infant.vaccination.visits.6w",
        detailKey: "infant.vaccination.visitDetail.6w",
        due: { unit: "week", from: 6, to: 6 },
        doses: [
            { key: "pentavalent_1", name: "Pentavalent", vaccine: "pentavalent", doseKind: "number", doseNumber: 1, note: true },
            { key: "opv_1", name: "OPV", vaccine: "opv", doseKind: "number", doseNumber: 1, note: true },
            { key: "rotavirus_rvv_1", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 1, note: true },
            { key: "pcv_1", name: "PCV", vaccine: "pcv", doseKind: "number", doseNumber: 1 },
            { key: "fipv_ipv_1", name: "fIPV (IPV)", vaccine: "fipv_ipv", doseKind: "number", doseNumber: 1, note: true },
        ],
    },
    {
        key: "10w",
        labelKey: "infant.vaccination.visits.10w",
        detailKey: "infant.vaccination.visitDetail.10w",
        due: { unit: "week", from: 10, to: 10 },
        doses: [
            { key: "pentavalent_2", name: "Pentavalent", vaccine: "pentavalent", doseKind: "number", doseNumber: 2, note: true },
            { key: "opv_2", name: "OPV", vaccine: "opv", doseKind: "number", doseNumber: 2, note: true },
            { key: "rotavirus_rvv_2", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 2, note: true },
        ],
    },
    {
        key: "14w",
        labelKey: "infant.vaccination.visits.14w",
        detailKey: "infant.vaccination.visitDetail.14w",
        due: { unit: "week", from: 14, to: 14 },
        doses: [
            { key: "pentavalent_3", name: "Pentavalent", vaccine: "pentavalent", doseKind: "number", doseNumber: 3, note: true },
            { key: "opv_3", name: "OPV", vaccine: "opv", doseKind: "number", doseNumber: 3, note: true },
            { key: "rotavirus_rvv_3", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 3, note: true },
            { key: "pcv_2", name: "PCV", vaccine: "pcv", doseKind: "number", doseNumber: 2 },
            { key: "fipv_ipv_2", name: "fIPV (IPV)", vaccine: "fipv_ipv", doseKind: "number", doseNumber: 2, note: true },
        ],
    },
    {
        key: "9-12m",
        labelKey: "infant.vaccination.visits.9-12m",
        due: { unit: "month", from: 9, to: 12 },
        doses: [
            { key: "measles_rubella_mr_1", name: "Measles-Rubella (MR)", vaccine: "measles_rubella_mr", doseKind: "number", doseNumber: 1 },
            { key: "je_1", name: "JE", vaccine: "je", doseKind: "number", doseNumber: 1, note: true },
            { key: "pcv_booster", name: "PCV", vaccine: "pcv", doseKind: "booster" },
            { key: "fipv_ipv_3", name: "fIPV (IPV)", vaccine: "fipv_ipv", doseKind: "number", doseNumber: 3, note: true },
            { key: "vitamin_a_1", name: "Vitamin A", vaccine: "vitamin_a", doseKind: "number", doseNumber: 1, supplement: true },
        ],
    },
    {
        key: "16-24m",
        labelKey: "infant.vaccination.visits.16-24m",
        due: { unit: "month", from: 16, to: 24 },
        doses: [
            { key: "dpt_booster_1", name: "DPT", vaccine: "dpt", doseKind: "booster", doseNumber: 1 },
            { key: "opv_booster", name: "OPV", vaccine: "opv", doseKind: "booster", note: true },
            { key: "measles_rubella_mr_2", name: "Measles-Rubella (MR)", vaccine: "measles_rubella_mr", doseKind: "number", doseNumber: 2 },
            { key: "je_2", name: "JE", vaccine: "je", doseKind: "number", doseNumber: 2, note: true },
            { key: "vitamin_a_2", name: "Vitamin A", vaccine: "vitamin_a", doseKind: "number", doseNumber: 2, supplement: true },
        ],
    },
];

/** The private paediatrician (IAP) schedule. NOT clinically reviewed — see the generator. */
export const IAP_VACCINATION_VISITS: IVaccinationVisit[] = [
    {
        key: "birth",
        labelKey: "infant.vaccination.visits.birth",
        detailKey: "infant.vaccination.visitDetail.birth",
        due: { unit: "week", from: 0, to: 0 },
        doses: [
            { key: "bcg", name: "BCG", vaccine: "bcg", doseKind: "single", note: true },
            { key: "hepatitis_b_birth", name: "Hepatitis B", vaccine: "hepatitis_b", doseKind: "birth", note: true },
            { key: "opv_birth", name: "OPV", vaccine: "opv", doseKind: "birth", note: true },
        ],
    },
    {
        key: "6w",
        labelKey: "infant.vaccination.visits.6w",
        detailKey: "infant.vaccination.visitDetail.6w",
        due: { unit: "week", from: 6, to: 6 },
        doses: [
            { key: "dtwp_dtap_1", name: "DTwP/DTaP", vaccine: "dtwp_dtap", doseKind: "number", doseNumber: 1 },
            { key: "ipv_1", name: "IPV", vaccine: "ipv", doseKind: "number", doseNumber: 1, note: true },
            { key: "hib_1", name: "Hib", vaccine: "hib", doseKind: "number", doseNumber: 1 },
            { key: "hepatitis_b_2", name: "Hepatitis B", vaccine: "hepatitis_b", doseKind: "number", doseNumber: 2 },
            { key: "pcv_1", name: "PCV", vaccine: "pcv", doseKind: "number", doseNumber: 1 },
            { key: "rotavirus_rvv_1", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 1, note: true },
        ],
    },
    {
        key: "10w",
        labelKey: "infant.vaccination.visits.10w",
        detailKey: "infant.vaccination.visitDetail.10w",
        due: { unit: "week", from: 10, to: 10 },
        doses: [
            { key: "dtwp_dtap_2", name: "DTwP/DTaP", vaccine: "dtwp_dtap", doseKind: "number", doseNumber: 2 },
            { key: "ipv_2", name: "IPV", vaccine: "ipv", doseKind: "number", doseNumber: 2, note: true },
            { key: "hib_2", name: "Hib", vaccine: "hib", doseKind: "number", doseNumber: 2 },
            { key: "pcv_2", name: "PCV", vaccine: "pcv", doseKind: "number", doseNumber: 2 },
            { key: "rotavirus_rvv_2", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 2, note: true },
        ],
    },
    {
        key: "14w",
        labelKey: "infant.vaccination.visits.14w",
        detailKey: "infant.vaccination.visitDetail.14w",
        due: { unit: "week", from: 14, to: 14 },
        doses: [
            { key: "dtwp_dtap_3", name: "DTwP/DTaP", vaccine: "dtwp_dtap", doseKind: "number", doseNumber: 3 },
            { key: "ipv_3", name: "IPV", vaccine: "ipv", doseKind: "number", doseNumber: 3, note: true },
            { key: "hib_3", name: "Hib", vaccine: "hib", doseKind: "number", doseNumber: 3 },
            { key: "pcv_3", name: "PCV", vaccine: "pcv", doseKind: "number", doseNumber: 3 },
            { key: "rotavirus_rvv_3", name: "Rotavirus (RVV)", vaccine: "rotavirus_rvv", doseKind: "number", doseNumber: 3, note: true },
        ],
    },
    {
        key: "6m",
        labelKey: "infant.vaccination.visits.6m",
        due: { unit: "month", from: 6, to: 6 },
        doses: [
            { key: "hepatitis_b_3", name: "Hepatitis B", vaccine: "hepatitis_b", doseKind: "number", doseNumber: 3 },
            { key: "influenza_1", name: "Influenza", vaccine: "influenza", doseKind: "number", doseNumber: 1, note: true },
        ],
    },
    {
        key: "9m",
        labelKey: "infant.vaccination.visits.9m",
        due: { unit: "month", from: 9, to: 9 },
        doses: [
            { key: "mmr_1", name: "MMR", vaccine: "mmr", doseKind: "number", doseNumber: 1 },
            { key: "influenza_2", name: "Influenza", vaccine: "influenza", doseKind: "number", doseNumber: 2, note: true },
        ],
    },
    {
        key: "12m",
        labelKey: "infant.vaccination.visits.12m",
        due: { unit: "month", from: 12, to: 12 },
        doses: [
            { key: "hepatitis_a_1", name: "Hepatitis A", vaccine: "hepatitis_a", doseKind: "number", doseNumber: 1 },
        ],
    },
    {
        key: "15m",
        labelKey: "infant.vaccination.visits.15m",
        due: { unit: "month", from: 15, to: 15 },
        doses: [
            { key: "mmr_2", name: "MMR", vaccine: "mmr", doseKind: "number", doseNumber: 2 },
            { key: "varicella_1", name: "Varicella", vaccine: "varicella", doseKind: "number", doseNumber: 1 },
            { key: "pcv_booster", name: "PCV", vaccine: "pcv", doseKind: "booster" },
        ],
    },
    {
        key: "18m",
        labelKey: "infant.vaccination.visits.18m",
        due: { unit: "month", from: 18, to: 18 },
        doses: [
            { key: "dtwp_dtap_booster_1", name: "DTwP/DTaP", vaccine: "dtwp_dtap", doseKind: "booster", doseNumber: 1 },
            { key: "ipv_booster", name: "IPV", vaccine: "ipv", doseKind: "booster", note: true },
            { key: "hib_booster", name: "Hib", vaccine: "hib", doseKind: "booster" },
            { key: "hepatitis_a_2", name: "Hepatitis A", vaccine: "hepatitis_a", doseKind: "number", doseNumber: 2 },
        ],
    },
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
];
