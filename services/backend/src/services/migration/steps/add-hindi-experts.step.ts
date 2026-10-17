/**
 * Migration step: add-hindi-experts.step.ts
 * Contains all data and the migrate() function.
 * Imported by the CLI script (scripts/) and by MigrationService.
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import mongoose from "mongoose";

import expertModel from "../../../models/expert.model";
import { IExpertTranslationBundle } from "../../../types/expert.types";

// _id -> Hindi bundle
const HINDI_BY_ID: Record<string, IExpertTranslationBundle> = {
    "69576e511bacdc226810d97f": {
        name: "डॉ. सौम्या प्रसाद",
        speciality: "प्रसूति एवं स्त्री रोग विशेषज्ञ",
    },
    "69576e731bacdc226810d981": {
        name: "डॉ. उमंग सलोदिया",
        speciality: "सामान्य चिकित्सक",
    },
    "69576e861bacdc226810d983": {
        name: "डॉ. अनुराधा कुमारी",
        speciality: "आहार विशेषज्ञ",
    },
    "69576e981bacdc226810d985": {
        name: "डॉ. हर्षा तोमर",
        speciality: "प्रमाणित प्रसवोत्तर ट्रांज़िशन एवं स्तनपान कोच",
    },
    "69576eb71bacdc226810d987": {
        name: "डॉ. आकांक्षा सिंह",
        speciality: "प्रसूति एवं स्त्री रोग विशेषज्ञ",
    },
    "69576f0f1bacdc226810d989": {
        name: "डॉ. प्रमिला",
        speciality: "प्रसवोत्तर योग विशेषज्ञ एवं पोषण विशेषज्ञ",
    },
    "69576f161bacdc226810d98b": {
        name: "डॉ. अंजना सेन",
        speciality: "भावनात्मक कल्याण कोच",
    },
    "69576f1c1bacdc226810d98d": {
        name: "डॉ. गौरव सिंह",
        speciality: "बाल रोग विशेषज्ञ",
    },
    "69576f211bacdc226810d98f": {
        name: "डॉ. सुमित गक्खड़",
        speciality: "मानसिक स्वास्थ्य विशेषज्ञ",
    },
    "69576f251bacdc226810d991": {
        name: "डॉ. रजनी",
        speciality: "नैदानिक मनोवैज्ञानिक",
    },
    "69576f2c1bacdc226810d993": {
        name: "सुश्री सुलक्षणा गोरे",
        speciality: "स्तनपान विशेषज्ञ",
    },
    "69576f311bacdc226810d995": {
        name: "सुश्री कल्पना तेओतिया",
        speciality: "प्रसवोत्तर मसाज थेरेपिस्ट",
    },
    "69576f361bacdc226810d997": {
        name: "डॉ. उपासना शाह",
        speciality: "फिज़ियोथेरेपिस्ट",
    },
    "69576f3b1bacdc226810d999": {
        name: "सुश्री महक अरोड़ा",
        speciality: "प्रसवोत्तर योग थेरेपिस्ट",
    },
    "69576f401bacdc226810d99b": {
        name: "डॉ. अंजली",
        speciality: "मूत्र रोग विशेषज्ञ",
    },
    "695cdb1ab68ca4004106e2d5": {
        name: "डॉ. राहुल",
        speciality: "मूत्र रोग विशेषज्ञ",
    },
};

export async function migrate(): Promise<{ updated: number; missing: number }> {
    let updated = 0;
    let missing = 0;

    for (const [id, bundle] of Object.entries(HINDI_BY_ID)) {
        const res = await expertModel.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { "translations.hi": bundle } },
        );

        if (res.matchedCount === 0) {
            console.warn(`No expert found for _id=${id}`);
            missing += 1;
        } else {
            updated += 1;
        }
    }

    console.log(`Done. Updated ${updated} expert(s), ${missing} id(s) unmatched.`);
    return { updated, missing };
}
