/**
 * Migration step: seed-expert-categories.step.ts
 *
 * Seeds the expert categories into `expert_categories`. Upserts on `key`, so
 * re-running syncs the display name, description and covered-areas content to the
 * values below (the seed is the source of truth for this app-team-owned content)
 * without duplicating rows or churning `_id`s — which the expert.category refs
 * depend on staying stable.
 *
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import expertCategoryModel from "../../../models/expert-category.model";
import { IExpertCategory } from "../../../types/expert-category.types";
import { EExpertCategory } from "../../../types/expert.types";

type CategorySeed = Pick<IExpertCategory, "key" | "name" | "description" | "coveredAreas"> & {
    translations?: {
        hi?: {
            name?: string;
            description?: string;
            coveredAreas?: string[];
        };
    };
};

export const EXPERT_CATEGORY_SEED: CategorySeed[] = [
    {
        key: EExpertCategory.NUTRITIONIST,
        name: "Nutritionist",
        description: "For food and diet questions - what to eat, what to avoid, and why.",
        coveredAreas: [
            "What to eat during pregnancy",
            "Foods to help boost milk supply",
            "What to eat for recovery after delivery",
            "Diet for low energy, weakness or anemia",
            "Managing PCOS, thyroid or sugar through diet",
            "Starting solids and planning baby's meals",
            "Losing weight safely after delivery",
        ],
        translations: {
            hi: {
                name: "पोषण विशेषज्ञ",
                description: "खाने-पीने से जुड़े सवालों के लिए — क्या खाएं, क्या न खाएं और क्यों।",
                coveredAreas: [
                    "गर्भावस्था में क्या खाएं",
                    "दूध बढ़ाने में मदद करने वाले खाद्य पदार्थ",
                    "प्रसव के बाद रिकवरी के लिए क्या खाएं",
                    "कम ऊर्जा, कमज़ोरी या एनीमिया के लिए आहार",
                    "आहार से PCOS, थायरॉइड या शुगर का प्रबंधन",
                    "ठोस आहार की शुरुआत और शिशु के भोजन की योजना",
                    "प्रसव के बाद सुरक्षित रूप से वज़न कम करना",
                ],
            },
        },
    },
    {
        key: EExpertCategory.LACTATION_CONSULTANT,
        name: "Lactation Consultant",
        description: "For feeding problems specifically, latch, pain, or supply, hands-on help.",
        coveredAreas: [
            "Pain while feeding",
            "Low or reducing milk supply",
            "Baby not latching or attaching properly",
            "Baby refusing or fussing at the breast",
            "Sore, cracked or bleeding nipples",
            "Engorgement, blocked ducts or breast lumps",
        ],
        translations: {
            hi: {
                name: "स्तनपान सलाहकार",
                description:
                    "दूध पिलाने से जुड़ी विशेष समस्याओं के लिए — लैच, दर्द या दूध की मात्रा।",
                coveredAreas: [
                    "दूध पिलाते समय दर्द",
                    "दूध कम होना या घटना",
                    "शिशु का ठीक से लैच न करना",
                    "शिशु का स्तन से मना करना या उधम मचाना",
                    "दर्दनाक, फटे या खून निकलते निप्पल",
                    "स्तन में भराव, बंद नलिकाएं या गांठ",
                ],
            },
        },
    },
    {
        key: EExpertCategory.GYNECOLOGIST,
        name: "Gynaecologist",
        description:
            "For your reproductive health - periods, pregnancy, hormones, at any life stage.",
        coveredAreas: [
            "Irregular, heavy or painful periods",
            "PCOS or hormonal imbalance",
            "Trouble conceiving or planning a baby",
            "Pregnancy care and concerns",
            "Vaginal infection, discharge or itching",
            "Pain or discomfort during or after sex",
            "Contraception and family planning",
            "Perimenopause - irregular cycles, mood swings or sleep changes",
            "Menopause - hot flashes, dryness or mood changes",
        ],
        translations: {
            hi: {
                name: "स्त्री रोग विशेषज्ञ",
                description:
                    "प्रजनन स्वास्थ्य के लिए — पीरियड्स, गर्भावस्था, हार्मोन, किसी भी उम्र में।",
                coveredAreas: [
                    "अनियमित, भारी या दर्दनाक पीरियड्स",
                    "PCOS या हार्मोनल असंतुलन",
                    "गर्भधारण में कठिनाई या बच्चे की योजना",
                    "गर्भावस्था की देखभाल और चिंताएं",
                    "योनि संक्रमण, स्राव या खुजली",
                    "संभोग के दौरान या बाद में दर्द या असुविधा",
                    "गर्भनिरोधक और परिवार नियोजन",
                    "पेरिमेनोपॉज़ — अनियमित चक्र, मूड स्विंग या नींद में बदलाव",
                    "मेनोपॉज़ — गर्म चमक, सूखापन या मूड में बदलाव",
                ],
            },
        },
    },
    {
        key: EExpertCategory.PEDIATRICIAN,
        name: "Paediatrician",
        description: "For your baby's health - illness, feeding, growth and development.",
        coveredAreas: [
            "Baby's fever, cough or cold",
            "Vomiting, loose motions or constipation",
            "Colic, gas or constant crying",
            "Feeding trouble or slow weight gain",
            "Rashes or other skin problems",
            "Vaccination, growth and milestone guidance",
        ],
        translations: {
            hi: {
                name: "बाल रोग विशेषज्ञ",
                description: "आपके शिशु की सेहत के लिए — बीमारी, खानपान, विकास और बढ़त।",
                coveredAreas: [
                    "शिशु को बुखार, खांसी या ज़ुकाम",
                    "उल्टी, दस्त या कब्ज़",
                    "पेट का दर्द, गैस या लगातार रोना",
                    "खाने में परेशानी या धीमी वज़न बढ़त",
                    "चकत्ते या त्वचा की अन्य समस्याएं",
                    "टीकाकरण, विकास और माइलस्टोन मार्गदर्शन",
                ],
            },
        },
    },
    {
        key: EExpertCategory.PSYCHOLOGIST,
        name: "Psychologist",
        description:
            "For working through feelings and adjusting to change - no medication, just support and coping tools.",
        coveredAreas: [
            "Feeling low, sad or tearful",
            "Anxiety, worry or overthinking",
            "Adjusting to motherhood",
            "Stress from work, family or relationships",
            "Feeling overwhelmed or unable to cope",
            "Mood swings, irritability or anger",
        ],
        translations: {
            hi: {
                name: "मनोवैज्ञानिक",
                description:
                    "भावनाओं को समझने और बदलाव के साथ तालमेल बिठाने के लिए — कोई दवाई नहीं, सिर्फ सहारा और उपकरण।",
                coveredAreas: [
                    "उदास, दुखी या रोने जैसा महसूस करना",
                    "चिंता, फ़िक्र या अत्यधिक सोचना",
                    "मातृत्व के साथ तालमेल बिठाना",
                    "काम, परिवार या रिश्तों से तनाव",
                    "अभिभूत या सामना न कर पाने जैसा महसूस करना",
                    "मूड स्विंग, चिड़चिड़ापन या गुस्सा",
                ],
            },
        },
    },
    {
        key: EExpertCategory.COUNSELLING_PSYCHOLOGIST,
        name: "Counselling Psychologist",
        description:
            "For talking things through - relationships, decisions and everyday stress, in a space that's just yours.",
        coveredAreas: [
            "Relationship or marriage difficulties",
            "Tension with in-laws or family",
            "Loneliness or lack of support at home",
            "Guilt, self-doubt or loss of confidence",
            "Difficult decisions about work, family or motherhood",
            "Grief, pregnancy loss or a difficult birth experience",
        ],
        translations: {
            hi: {
                name: "परामर्श मनोवैज्ञानिक",
                description:
                    "मन की बात कहने के लिए — रिश्ते, फैसले और रोज़मर्रा का तनाव, ऐसी जगह जो सिर्फ आपकी है।",
                coveredAreas: [
                    "रिश्तों या वैवाहिक जीवन में कठिनाइयां",
                    "ससुराल या परिवार के साथ तनाव",
                    "अकेलापन या घर में सहारे की कमी",
                    "अपराधबोध, आत्म-संदेह या आत्मविश्वास में कमी",
                    "काम, परिवार या मातृत्व से जुड़े कठिन फैसले",
                    "शोक, गर्भ का नुकसान या कठिन प्रसव का अनुभव",
                ],
            },
        },
    },
    {
        key: EExpertCategory.PSYCHIATRIST,
        name: "Psychiatrist",
        description:
            "If it's been going on for a while, feels severe, or you think medication might help.",
        coveredAreas: [
            "Persistent sadness or depression for more than two weeks",
            "Severe anxiety or panic attacks",
            "Sleep problems or insomnia",
            "Starting or reviewing mental health medication",
            "Feeling hopeless or having distressing thoughts - you don't have to be in crisis to reach out; we're here to listen",
        ],
        translations: {
            hi: {
                name: "मनोचिकित्सक",
                description:
                    "यदि समस्या लंबे समय से हो, गंभीर लगे, या आपको लगे कि दवाई मदद कर सकती है।",
                coveredAreas: [
                    "दो हफ्तों से अधिक समय से लगातार उदासी या अवसाद",
                    "गंभीर चिंता या पैनिक अटैक",
                    "नींद की समस्या या अनिद्रा",
                    "मानसिक स्वास्थ्य दवाई शुरू करना या समीक्षा करना",
                    "निराशा महसूस करना या परेशान करने वाले विचार आना — संकट में होने की ज़रूरत नहीं, हम सुनने के लिए यहाँ हैं",
                ],
            },
        },
    },
    {
        key: EExpertCategory.GENERAL_PHYSICIAN,
        name: "General Physician",
        description:
            "For everyday health concerns that don't fit a specialist or if you're just not sure where to start.",
        coveredAreas: [
            "Fever, cough or cold",
            "Ongoing tiredness or weakness",
            "Acidity, gas or indigestion",
            "Headaches or body pain",
            "Burning urine or a suspected infection",
            "Not feeling well but unsure who to consult",
        ],
        translations: {
            hi: {
                name: "सामान्य चिकित्सक",
                description:
                    "रोज़मर्रा की स्वास्थ्य समस्याओं के लिए जो किसी विशेषज्ञ के दायरे में न आएं या जब यह न पता हो कि कहाँ से शुरू करें।",
                coveredAreas: [
                    "बुखार, खांसी या ज़ुकाम",
                    "लगातार थकान या कमज़ोरी",
                    "एसिडिटी, गैस या अपच",
                    "सिरदर्द या शरीर में दर्द",
                    "पेशाब में जलन या संक्रमण का संदेह",
                    "तबियत ठीक न लगना पर यह न पता होना कि किससे मिलें",
                ],
            },
        },
    },
];

export interface SeedExpertCategoriesResult {
    upserted: number;
    modified: number;
}

export async function migrate(): Promise<SeedExpertCategoriesResult> {
    let upserted = 0;
    let modified = 0;

    for (const category of EXPERT_CATEGORY_SEED) {
        const result = await expertCategoryModel.updateOne(
            { key: category.key },
            {
                // Content fields are refreshed from this seed on every run.
                $set: {
                    name: category.name,
                    description: category.description,
                    // The intro line is also the first covered-area item.
                    coveredAreas: [category.description, ...category.coveredAreas],
                    translations: category.translations ?? {},
                },
                // Set only on first insert so an operator can toggle a category off
                // in the DB without a re-run reviving it.
                $setOnInsert: { key: category.key, isActive: true },
            },
            { upsert: true },
        );

        if (result.upsertedCount) upserted += result.upsertedCount;
        if (result.modifiedCount) modified += result.modifiedCount;
    }

    console.log(`Expert categories seeded. Upserted: ${upserted}, Modified: ${modified}.`);
    return { upserted, modified };
}
