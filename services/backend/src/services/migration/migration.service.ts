/**
 * MigrationService
 *
 * Runs all Hindi i18n migration scripts in sequence using the existing
 * mongoose connection (no connect/disconnect — the server is already connected).
 *
 * Each step is idempotent and re-runnable. Failures in one step are caught,
 * logged, and reported without aborting the remaining steps.
 */

import { migrate as migrateTranslations } from "./steps/add-hindi-translations.step";
import { migrate as migrateRecommendations } from "./steps/add-hindi-recommendations.step";
import { migrate as migrateProducts } from "./steps/add-hindi-products.step";
import { migrate as migrateExperts } from "./steps/add-hindi-experts.step";
import { migrate as migrateCareManagers } from "./steps/add-hindi-care-managers.step";
import { migrate as migrateContents } from "./steps/add-hindi-contents.step";
import { migrate as migrateSubscriptionModelP0 } from "./steps/subscription-model-p0.step";
import { migrate as seedSubscriptionPlans } from "./steps/seed-subscription-plans.step";
import { migrate as seedExpertCategories } from "./steps/seed-expert-categories.step";
import { migrate as migrateExpertCategoryToRef } from "./steps/migrate-expert-category-to-ref.step";
import { migrate as addExpertEmpanelment } from "./steps/add-expert-empanelment.step";
import { migrate as addConsultantContactWhatsapp } from "./steps/add-consultant-contact-whatsapp.step";
import { migrate as addCareManagerRemuneration } from "./steps/add-care-manager-remuneration.step";
import { migrate as migrateConsultationOrderToConsultantRef } from "./steps/migrate-consultation-order-to-consultant-ref.step";
import { migrate as addNpCategoryToContents } from "./steps/add-np-category-to-contents.step";
import { migrate as addNpCategoryToProducts } from "./steps/add-np-category-to-products.step";
import { migrate as dropExpertReferralCodeIndex } from "./steps/drop-expert-referral-code-index.step";
import { migrate as seedReferralProgramsFromExperts } from "./steps/seed-referral-programs-from-experts.step";
import { migrate as backfillReferralRedemptions } from "./steps/backfill-referral-redemptions.step";
import { migrate as addPlayProductIds } from "./steps/add-play-product-ids.step";
import { migrate as addOnboardingFeedingNode } from "./steps/add-onboarding-feeding-node.step";
import { migrate as rebrandPerinatalFlowCopy } from "./steps/rebrand-perinatal-flow-copy.step";

export interface MigrationStepResult {
    step: string;
    status: "ok" | "error";
    detail?: Record<string, unknown>;
    error?: string;
}

export interface MigrationRunResult {
    success: boolean;
    steps: MigrationStepResult[];
    durationMs: number;
}

const STEPS: Array<{ name: string; fn: () => Promise<unknown> }> = [
    { name: "hindi-translations", fn: migrateTranslations },
    { name: "hindi-recommendations", fn: migrateRecommendations },
    { name: "hindi-products", fn: migrateProducts },
    { name: "hindi-experts", fn: migrateExperts },
    { name: "hindi-care-managers", fn: migrateCareManagers },
    { name: "hindi-contents", fn: migrateContents },
    // Runs after the Hindi steps: those seed translations onto documents this step then
    // reshapes, and reversing the order would have the i18n steps match on a category
    // field whose type is mid-migration.
    { name: "subscription-model-p0", fn: migrateSubscriptionModelP0 },
    { name: "seed-subscription-plans", fn: seedSubscriptionPlans },
    // add-expert-referral-codes is deliberately NO LONGER REGISTERED. It minted a code
    // onto every new expert document, which was the right thing when the expert was the
    // only place a code could live. Codes are now born as `referral_programs` rows
    // created through the admin API — a deliberate act, since a code carries a plan.
    // Leaving it registered would keep manufacturing expert codes that no longer mean
    // anything on their own. The file is kept: it is what produced the codes the seed
    // step below imports.

    // Categories must be seeded before experts can be pointed at them.
    { name: "seed-expert-categories", fn: seedExpertCategories },
    { name: "migrate-expert-category-to-ref", fn: migrateExpertCategoryToRef },
    { name: "add-expert-empanelment", fn: addExpertEmpanelment },
    { name: "add-consultant-contact-whatsapp", fn: addConsultantContactWhatsapp },
    { name: "add-care-manager-remuneration", fn: addCareManagerRemuneration },
    {
        name: "migrate-consultation-order-to-consultant-ref",
        fn: migrateConsultationOrderToConsultantRef,
    },
    // Runs after the Hindi content step: that one matches articles by their English
    // title to attach translations, and widening `category` does not disturb it either
    // way — but keeping content edits in authoring order stays easier to reason about.
    { name: "add-np-category-to-contents", fn: addNpCategoryToContents },
    { name: "add-np-category-to-products", fn: addNpCategoryToProducts },
    // Referral programs. Order matters and is not arbitrary:
    //   1. the unique index on experts.referralCode goes first, since it is what makes
    //      creating a code-less expert throw;
    //   2. programs are imported from the codes already on expert documents — a
    //      one-way promotion, run repeatedly only because there is no migration ledger;
    //   3. redemptions are backfilled last, because each one looks up the program the
    //      previous step created.
    { name: "drop-expert-referral-code-index", fn: dropExpertReferralCodeIndex },
    { name: "seed-referral-programs-from-experts", fn: seedReferralProgramsFromExperts },
    { name: "backfill-referral-redemptions", fn: backfillReferralRedemptions },
    // After seed-subscription-plans: it maps rows that step is responsible for creating.
    { name: "add-play-product-ids", fn: addPlayProductIds },
    // After add-hindi-translations: that step overwrites `translations.hi` wholesale, so
    // running it afterwards would drop the Hindi this one writes for the new node.
    { name: "add-onboarding-feeding-node", fn: addOnboardingFeedingNode },
    // Also after add-hindi-translations, for the same reason: that step rewrites
    // `translations.hi` wholesale, so anything asserting Hindi has to follow it.
    { name: "rebrand-perinatal-flow-copy", fn: rebrandPerinatalFlowCopy },
];

export async function runAllMigrations(): Promise<MigrationRunResult> {
    const start = Date.now();
    const results: MigrationStepResult[] = [];

    for (const { name, fn } of STEPS) {
        console.log(`[MigrationService] Starting step: ${name}`);
        try {
            const detail = (await fn()) as Record<string, unknown> | undefined;
            console.log(`[MigrationService] Step OK: ${name}`, detail);
            results.push({ step: name, status: "ok", detail: detail ?? {} });
        } catch (err: any) {
            const message = err?.message ?? String(err);
            console.error(`[MigrationService] Step FAILED: ${name}`, err);
            results.push({ step: name, status: "error", error: message });
        }
    }

    return {
        success: results.every((r) => r.status === "ok"),
        steps: results,
        durationMs: Date.now() - start,
    };
}
