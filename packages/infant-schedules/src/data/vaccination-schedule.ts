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
 * The narrower slice @vivamama/infant-schedules needs: which visits exist, when each is
 * due, and which dose keys it covers. No display copy — that stays in
 * apps/mobile/src/data/infantVaccinationData.ts, the one place that renders it.
 */
import { VaccinationSector, VaccinationVisitWindow } from "../types";

export const VACCINATION_SCHEDULE_WINDOWS: Record<VaccinationSector, VaccinationVisitWindow[]> = {
    public: [
        {
            key: "birth",
            due: { unit: "week", from: 0, to: 0 },
            doseKeys: [
                "bcg",
                "opv_birth",
                "hepatitis_b_birth",
            ],
        },
        {
            key: "6w",
            due: { unit: "week", from: 6, to: 6 },
            doseKeys: [
                "pentavalent_1",
                "opv_1",
                "rotavirus_rvv_1",
                "pcv_1",
                "fipv_ipv_1",
            ],
        },
        {
            key: "10w",
            due: { unit: "week", from: 10, to: 10 },
            doseKeys: [
                "pentavalent_2",
                "opv_2",
                "rotavirus_rvv_2",
            ],
        },
        {
            key: "14w",
            due: { unit: "week", from: 14, to: 14 },
            doseKeys: [
                "pentavalent_3",
                "opv_3",
                "rotavirus_rvv_3",
                "pcv_2",
                "fipv_ipv_2",
            ],
        },
        {
            key: "9-12m",
            due: { unit: "month", from: 9, to: 12 },
            doseKeys: [
                "measles_rubella_mr_1",
                "je_1",
                "pcv_booster",
                "fipv_ipv_3",
                "vitamin_a_1",
            ],
        },
        {
            key: "16-24m",
            due: { unit: "month", from: 16, to: 24 },
            doseKeys: [
                "dpt_booster_1",
                "opv_booster",
                "measles_rubella_mr_2",
                "je_2",
                "vitamin_a_2",
            ],
        },
    ],
    private: [
        {
            key: "birth",
            due: { unit: "week", from: 0, to: 0 },
            doseKeys: [
                "bcg",
                "hepatitis_b_birth",
                "opv_birth",
            ],
        },
        {
            key: "6w",
            due: { unit: "week", from: 6, to: 6 },
            doseKeys: [
                "dtwp_dtap_1",
                "ipv_1",
                "hib_1",
                "hepatitis_b_2",
                "pcv_1",
                "rotavirus_rvv_1",
            ],
        },
        {
            key: "10w",
            due: { unit: "week", from: 10, to: 10 },
            doseKeys: [
                "dtwp_dtap_2",
                "ipv_2",
                "hib_2",
                "pcv_2",
                "rotavirus_rvv_2",
            ],
        },
        {
            key: "14w",
            due: { unit: "week", from: 14, to: 14 },
            doseKeys: [
                "dtwp_dtap_3",
                "ipv_3",
                "hib_3",
                "pcv_3",
                "rotavirus_rvv_3",
            ],
        },
        {
            key: "6m",
            due: { unit: "month", from: 6, to: 6 },
            doseKeys: [
                "hepatitis_b_3",
                "influenza_1",
            ],
        },
        {
            key: "9m",
            due: { unit: "month", from: 9, to: 9 },
            doseKeys: [
                "mmr_1",
                "influenza_2",
            ],
        },
        {
            key: "12m",
            due: { unit: "month", from: 12, to: 12 },
            doseKeys: [
                "hepatitis_a_1",
            ],
        },
        {
            key: "15m",
            due: { unit: "month", from: 15, to: 15 },
            doseKeys: [
                "mmr_2",
                "varicella_1",
                "pcv_booster",
            ],
        },
        {
            key: "18m",
            due: { unit: "month", from: 18, to: 18 },
            doseKeys: [
                "dtwp_dtap_booster_1",
                "ipv_booster",
                "hib_booster",
                "hepatitis_a_2",
            ],
        },
    ],
};
