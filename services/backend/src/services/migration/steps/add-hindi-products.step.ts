/**
 * Migration step: add-hindi-products.step.ts
 * Contains all data and the migrate() function.
 * Imported by the CLI script (scripts/) and by MigrationService.
 * Uses the existing mongoose connection — no connect/disconnect here.
 */
import mongoose from "mongoose";

import { IProductTranslationBundle } from "../../../types/products.types";
import productModel from "../../../models/product.model";

// ---- Shared bundles for the identical PP / NN catalogue items (ids differ) ----
const B = {
    sanitaryRegular: {
        productName: "सैनिटरी नैपकिन (रेगुलर)",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "रैश-फ्री, टॉक्सिन-फ्री और अल्ट्रा-सॉफ्ट सैनिटरी पैड (साइज़ L) | अल्ट्रा-थिन, लीक-प्रूफ, 50% चौड़ा बैक | हैवी फ्लो, इको-फ्रेंडली, 10 का पैक",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    sanitaryOvernight: {
        productName: "सैनिटरी नैपकिन (हैवी/रातभर)",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "अल्ट्रा-थिन XXXL (410mm) कॉटन सैनिटरी पैड | सुपर अब्ज़ॉर्बेंट, हैवी फ्लो और रैश-फ्री | शुद्ध U.S. कॉटन, टॉक्सिन व खुशबू-रहित, डिस्पोज़ेबल पाउच के साथ",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    pantyliners: {
        productName: "पैंटीलाइनर",
        productCategory: "सैनिटरी देखभाल",
        productDescription: "बेला पैंटी सॉफ्ट क्लासिक लाइनर, 60 का पैक | बिना खुशबू",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    tampons: {
        productName: "टैम्पोन",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "हैवी फ्लो के लिए टैम्पोन, 16 नग | गायनोकोलॉजिकली टेस्टेड | हाइपोएलर्जेनिक | तेज़ अवशोषण, लीक-प्रूफ",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    menstrualCup: {
        productName: "मेंस्ट्रुअल कप",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "हैवी फ्लो मेंस्ट्रुअल कप | लगाना व निकालना आसान | खास रिंग डिज़ाइन | प्रीमियम मेडिकल-ग्रेड सिलिकॉन",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    menstrualCupWash: {
        productName: "मेंस्ट्रुअल कप वॉश",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "मेंस्ट्रुअल कप क्लेंज़र/वॉश | कप की स्वच्छता बनाए रखे | दुर्गंध व दाग हटाए | 60ml | 99% बैक्टीरिया खत्म",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    menstrualCupSterilizer: {
        productName: "मेंस्ट्रुअल कप स्टरलाइज़र",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "महिलाओं के लिए मेंस्ट्रुअल कप स्टरलाइज़र | स्वच्छ तरीके से कप साफ करे | ऑटोमैटिक स्विच ऑफ | कप पिघलने का जोखिम नहीं | 1 नग, पिंक",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    periodPanties: {
        productName: "पीरियड पैंटी",
        productCategory: "सैनिटरी देखभाल",
        productDescription:
            "महिलाओं के लिए रीयूज़ेबल पीरियड पैंटी | कॉटन, स्पैन्डेक्स | लीक-प्रूफ, सैनिटरी पैड से 4 गुना अधिक सोखे | ब्लैक, लार्ज (2 का पैक)",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    heatingPadMassager: {
        productName: "हीटिंग पैड",
        productCategory: "पीरियड दर्द देखभाल",
        productDescription:
            "पीरियड क्रैम्प राहत मसाजर | पोर्टेबल कॉर्डलेस | 3 हीट व 3 मसाज मोड | LED डिस्प्ले | पीठ व पेट के लिए हीटिंग पैड",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    heatPatches: {
        productName: "हीट पैच",
        productCategory: "पीरियड दर्द देखभाल",
        productDescription:
            "मासिक धर्म ऐंठन के लिए हीटिंग व सूदिंग पैच, 7 नग | प्राकृतिक दर्द राहत | पोर्टेबल हीट थेरेपी, लंबे समय तक असर",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    ovulationStrips: {
        productName: "ओव्यूलेशन टेस्ट स्ट्रिप",
        productCategory: "साइकिल ट्रैकिंग",
        productDescription:
            "ओव्यूलेशन किट (5 का पैक) | 5 मिनट में सटीक नतीजे | सबसे उपजाऊ 5 दिनों की पहचान | क्लिनिकली टेस्टेड",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    basalThermometer: {
        productName: "बेसल थर्मामीटर",
        productCategory: "साइकिल ट्रैकिंग",
        productDescription:
            "ओव्यूलेशन व फर्टिलिटी के लिए बेसल थर्मामीटर | LED स्क्रीन | गर्भधारण की कोशिश हेतु | ऐप के साथ (iOS व Android)",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    magnesium: {
        productName: "मैग्नीशियम ग्लाइसिनेट",
        productCategory: "हार्मोनल स्वास्थ्य",
        productDescription:
            "ट्रिपल मैग्नीशियम कॉम्प्लेक्स 1000mg (ग्लाइसिनेट, सिट्रेट, थ्रिओनेट) | नींद, ऐंठन, रिकवरी, नस व मांसपेशी के लिए | 60 कैप्सूल",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    omega3Hormonal: {
        productName: "ओमेगा 3",
        productCategory: "हार्मोनल स्वास्थ्य",
        productDescription:
            "स्ट्रॉन्ग ओमेगा 3 फिश ऑयल कैप्सूल 2400mg (EPA 1080mg, DHA 800mg) करक्यूमिन के साथ | दिमाग, हृदय व जोड़ों के लिए | बिना फिशी बर्प | 60 कैप्सूल",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    vitaminD: {
        productName: "विटामिन डी",
        productCategory: "हार्मोनल स्वास्थ्य",
        productDescription:
            "विटामिन D3 + K2 (MK-7) | मज़बूत हड्डियाँ, इम्यूनिटी व कैल्शियम अवशोषण | 600 IU D3 + 55mcg K2 | 100% शाकाहारी (60 टैबलेट)",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    phWash: {
        productName: "पीएच संतुलित इंटिमेट वॉश",
        productCategory: "अंतरंग स्वच्छता",
        productDescription:
            "एक्सपर्ट इंटिमेट हाइजीन वॉश | टी ट्री ऑयल के साथ | सूखापन, खुजली व जलन से बचाव | pH संतुलित | पैराबेन-फ्री | 200ml",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    intimateWipes: {
        productName: "इंटिमेट वाइप्स",
        productCategory: "अंतरंग स्वच्छता",
        productDescription:
            "महिलाओं के लिए पीरियड स्टेन रिमूवर वाइप्स, 10 का पैक | 60 सेकंड में दाग हटाए | त्वचा व कपड़े पर सौम्य | ट्रैवल-फ्रेंडली",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    vaginalMoisturizer: {
        productName: "वजाइनल मॉइस्चराइज़र",
        productCategory: "अंतरंग स्वच्छता",
        productDescription:
            "इंटिमेट मॉइस्चराइज़िंग क्रीम | सूखापन व खुजली कम करे | pH संतुलन (3.5-4.5) | टी ट्री ऑयल के साथ | 30g ट्यूब",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    lubricantSexual: {
        productName: "वॉटर-बेस्ड लुब्रिकेंट",
        productCategory: "यौन कल्याण",
        productDescription:
            "100ml वॉटर-बेस्ड लुब्रिकेंट जेल | 100% सुरक्षित | pH संतुलित | नॉन-स्टिकी व दाग-रहित",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    condoms: {
        productName: "कंडोम वैरायटी पैक",
        productCategory: "यौन कल्याण",
        productDescription: "फीमेल कंडोम - 2 नग | सुरक्षित संबंध के लिए",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
} satisfies Record<string, IProductTranslationBundle>;

// ---- _id -> Hindi bundle ----
const HINDI_BY_ID: Record<string, IProductTranslationBundle> = {
    // PP catalogue
    "695694f902460f4eecb3c806": B.sanitaryRegular,
    "6956950902460f4eecb3c808": B.sanitaryOvernight,
    "6956951102460f4eecb3c80a": B.pantyliners,
    "6956951602460f4eecb3c80c": B.tampons,
    "695695e702460f4eecb3c80e": B.menstrualCup,
    "695695f202460f4eecb3c810": B.menstrualCupWash,
    "695695f702460f4eecb3c812": B.menstrualCupSterilizer,
    "695695fc02460f4eecb3c814": B.periodPanties,
    "6956960102460f4eecb3c816": B.heatingPadMassager,
    "6956960602460f4eecb3c818": B.heatPatches,
    "6956960c02460f4eecb3c81a": B.ovulationStrips,
    "6956961102460f4eecb3c81c": B.basalThermometer,
    "6956961802460f4eecb3c81e": B.magnesium,
    "6956961d02460f4eecb3c820": B.omega3Hormonal,
    "6956962202460f4eecb3c822": B.vitaminD,
    "6956962902460f4eecb3c824": B.phWash,
    "6956962e02460f4eecb3c826": B.intimateWipes,
    "6956963302460f4eecb3c828": B.vaginalMoisturizer,
    "6956963802460f4eecb3c82a": B.lubricantSexual,
    "6956963e02460f4eecb3c82c": B.condoms,

    // NN catalogue (same content, different ids)
    "69906ccdee7bd9bf5dda014d": B.sanitaryRegular,
    "69906ccdee7bd9bf5dda014e": B.sanitaryOvernight,
    "69906ccdee7bd9bf5dda014f": B.pantyliners,
    "69906ccdee7bd9bf5dda0150": B.tampons,
    "69906ccdee7bd9bf5dda0151": B.menstrualCup,
    "69906ccdee7bd9bf5dda0152": B.menstrualCupWash,
    "69906ccdee7bd9bf5dda0153": B.menstrualCupSterilizer,
    "69906ccdee7bd9bf5dda0154": B.periodPanties,
    "69906ccdee7bd9bf5dda0155": B.heatingPadMassager,
    "69906ccdee7bd9bf5dda0156": B.heatPatches,
    "69906ccdee7bd9bf5dda0157": B.ovulationStrips,
    "69906ccdee7bd9bf5dda0158": B.basalThermometer,
    "69906ccdee7bd9bf5dda0159": B.magnesium,
    "69906ccdee7bd9bf5dda015a": B.omega3Hormonal,
    "69906ccdee7bd9bf5dda015b": B.vitaminD,
    "69906ccdee7bd9bf5dda015c": B.phWash,
    "69906ccdee7bd9bf5dda015d": B.intimateWipes,
    "69906ccdee7bd9bf5dda015e": B.vaginalMoisturizer,
    "69906ccdee7bd9bf5dda015f": B.lubricantSexual,
    "69906ccdee7bd9bf5dda0160": B.condoms,

    // PG — breastfeeding prep
    "69906ccdee7bd9bf5dda0161": {
        productName: "नर्सिंग ब्रा पैक",
        productCategory: "स्तनपान की तैयारी",
        productDescription: "आगे से खुलने वाली सॉफ्ट ब्रा",
        safetyFlag: "गर्भावस्था में सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0162": {
        productName: "निप्पल बटर",
        productCategory: "स्तनपान की तैयारी",
        productDescription: "दूध पिलाने से पहले व बाद आराम के लिए",
        safetyFlag: "गर्भावस्था में सुरक्षित",
    },

    // PP — postpartum journey
    "69906ccdee7bd9bf5dda0163": {
        productName: "मैटरनिटी पैड (एक्स्ट्रा लॉन्ग)",
        productCategory: "प्रसवोत्तर रक्तस्राव",
        productDescription: "उच्च अवशोषण वाले लोकिया पैड",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0164": {
        productName: "डिस्पोज़ेबल प्रसवोत्तर अंडरवियर",
        productCategory: "प्रसवोत्तर रक्तस्राव",
        productDescription: "लीक-प्रूफ, सांस लेने योग्य",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0165": {
        productName: "पेरी बॉटल",
        productCategory: "पेरिनियल देखभाल",
        productDescription:
            "प्रसवोत्तर पेरिनियल वॉश बॉटल | झुके हुए स्पाउट वाली उल्टी निचोड़ बॉटल | मुश्किल जगहों की सफाई में मदद | ट्रैवल बैग के साथ",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0166": {
        productName: "विच हेज़ल पैड",
        productCategory: "पेरिनियल देखभाल",
        productDescription: "जलन व पीड़ा में आरामदायक",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0167": {
        productName: "आइस जेल पैड",
        productCategory: "पेरिनियल देखभाल",
        productDescription: "सूजन व दर्द से राहत",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0168": {
        productName: "सिट्ज़ बाथ बेसिन",
        productCategory: "पेरिनियल देखभाल",
        productDescription: "प्रसवोत्तर हीलिंग के लिए फोल्डेबल सिट्ज़ बाथ टब",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0169": {
        productName: "हाई-वेस्ट कॉटन पैंटी",
        productCategory: "सी-सेक्शन देखभाल",
        productDescription: "निशान के अनुकूल, सांस लेने योग्य",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda016a": {
        productName: "एब्डॉमिनल सपोर्ट तकिया",
        productCategory: "सी-सेक्शन देखभाल",
        productDescription: "खाँसने, हँसने व हिलने-डुलने में सहारा",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda016b": {
        productName: "निप्पल बाम (लैनोलिन या प्लांट-बेस्ड)",
        productCategory: "स्तनपान",
        productDescription: "फटे निप्पल की हीलिंग",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda016c": {
        productName: "ब्रेस्ट पैड (डिस्पोज़ेबल या धोने योग्य)",
        productCategory: "स्तनपान",
        productDescription: "रिसाव से सुरक्षा",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda016d": {
        productName: "स्तनपान तकिया",
        productCategory: "स्तनपान",
        productDescription: "बेहतर लैच व मुद्रा",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda016e": {
        productName: "2 लीटर स्ट्रॉ बॉटल",
        productCategory: "हाइड्रेशन",
        productDescription: "आसानी से सिप करते हुए स्तनपान",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda016f": {
        productName: "नर्सिंग नाइटवियर",
        productCategory: "आराम",
        productDescription: "आसान एक्सेस व आराम",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0170": {
        productName: "हाइड्रोजेल ब्रेस्ट पैड",
        productCategory: "स्तन देखभाल",
        productDescription: "निप्पल को ठंडक भरी राहत",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0171": {
        productName: "वॉर्म कंप्रेस पैड",
        productCategory: "स्तन देखभाल",
        productDescription: "स्तन भराव व नलिकाओं में राहत",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0172": {
        productName: "मैनुअल ब्रेस्ट पंप",
        productCategory: "स्तन देखभाल",
        productDescription: "भराव में राहत व कभी-कभी दूध निकालने के लिए",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0173": {
        productName: "बेली बाइंडर (सांस लेने योग्य)",
        productCategory: "प्रसवोत्तर शरीर",
        productDescription: "कोर व मुद्रा को सहारा",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0174": {
        productName: "हीटिंग पैड",
        productCategory: "गर्भाशय की ऐंठन",
        productDescription: "प्रसव के बाद के दर्द में राहत",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0175": {
        productName: "शांतिदायक हर्बल चाय",
        productCategory: "मनोदशा सहयोग",
        productDescription: "विश्राम में सहायक",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda0176": {
        productName: "आई मास्क और इयर प्लग",
        productCategory: "नींद सहयोग",
        productDescription: "बेहतर नींद की गुणवत्ता",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0177": {
        productName: "सिलिकॉन स्कार जेल शीट",
        productCategory: "निशान देखभाल",
        productDescription: "निशान में सुधार",
        safetyFlag: "4 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda0178": {
        productName: "पेल्विक फ्लोर ट्रेनर",
        productCategory: "पेल्विक स्वास्थ्य",
        productDescription: "केगल्स बायोफीडबैक",
        safetyFlag: "6 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda0179": {
        productName: "पेरिनियल मसाज ऑयल",
        productCategory: "पेल्विक स्वास्थ्य",
        productDescription: "आराम व ऊतकों को सहारा",
        safetyFlag: "6 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda017a": {
        productName: "वॉटर-बेस्ड लुब्रिकेंट",
        productCategory: "अंतरंगता देखभाल",
        productDescription: "सूखापन में आराम",
        safetyFlag: "स्तनपान में सुरक्षित, 6 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda017b": {
        productName: "बायोटिन सप्लीमेंट",
        productCategory: "बालों का झड़ना",
        productDescription: "बालों की रिकवरी में सहायक",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda017c": {
        productName: "आयरन सप्लीमेंट गमीज़",
        productCategory: "पोषण",
        productDescription: "थकान व एनीमिया में सहायक",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda017d": {
        productName: "कैल्शियम विटामिन डी",
        productCategory: "पोषण",
        productDescription: "हड्डियों को सहारा",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda017e": {
        productName: "ओमेगा 3",
        productCategory: "पोषण",
        productDescription: "मनोदशा व सूजन में सहायक",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda017f": {
        productName: "इलेक्ट्रिक ब्रेस्ट पंप",
        productCategory: "काम पर वापसी",
        productDescription: "कामकाजी माँ के लिए दूध निकालना",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0180": {
        productName: "मिल्क स्टोरेज बैग",
        productCategory: "काम पर वापसी",
        productDescription: "सुरक्षित भंडारण",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0181": {
        productName: "इंसुलेटेड मिल्क बैग",
        productCategory: "काम पर वापसी",
        productDescription: "ले जाने के लिए",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0182": {
        productName: "हैंड्सफ्री पंपिंग ब्रा",
        productCategory: "काम पर वापसी",
        productDescription: "पंपिंग में सुविधा",
        safetyFlag: "स्तनपान के दौरान सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0183": {
        productName: "योगा मैट",
        productCategory: "शारीरिक रिकवरी",
        productDescription: "हल्की गतिविधि",
        safetyFlag: "6 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda0184": {
        productName: "रेज़िस्टेंस बैंड (हल्के)",
        productCategory: "शारीरिक रिकवरी",
        productDescription: "मज़बूती व रिहैब",
        safetyFlag: "6 सप्ताह बाद उपयोग करें",
    },
    "69906ccdee7bd9bf5dda0185": {
        productName: "प्रसवोत्तर जर्नल",
        productCategory: "भावनात्मक पुनर्संतुलन",
        productDescription: "चिंतन व मनोदशा",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0186": {
        productName: "अफर्मेशन कार्ड्स",
        productCategory: "भावनात्मक पुनर्संतुलन",
        productDescription: "स्थिरता में सहयोग",
        safetyFlag: "केवल प्रसवोत्तर के लिए",
    },
    "69906ccdee7bd9bf5dda0187": {
        productName: "एप्सम सॉल्ट बाथ सोक",
        productCategory: "तनाव से राहत",
        productDescription: "मांसपेशियों को आराम",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
    "69906ccdee7bd9bf5dda0188": {
        productName: "सीड साइक्लिंग किट",
        productCategory: "हार्मोनल स्वास्थ्य",
        productDescription: "साइकिल लय में सहायक",
        safetyFlag: "डॉक्टर की स्वीकृति आवश्यक",
    },
    "69906ccdee7bd9bf5dda0189": {
        productName: "प्रसवोत्तर हर्बल बाथ किट",
        productCategory: "रिकवरी",
        productDescription:
            "ऑर्गेनिक आयुर्वेदिक प्रसवोत्तर बाथ किट – नई माताओं के लिए 45-दिन की हर्बल रिकवरी",
        safetyFlag: "सभी महिलाओं के लिए सुरक्षित",
    },
};

export async function migrate(): Promise<{ updated: number; missing: number }> {
    let updated = 0;
    let missing = 0;

    for (const [id, bundle] of Object.entries(HINDI_BY_ID)) {
        const res = await productModel.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { "translations.hi": bundle } },
        );

        if (res.matchedCount === 0) {
            console.warn(`No product found for _id=${id}`);
            missing += 1;
        } else {
            updated += 1;
        }
    }

    console.log(`Done. Updated ${updated} product(s), ${missing} id(s) unmatched.`);
    return { updated, missing };
}
