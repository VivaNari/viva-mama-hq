import Joi from "joi";

import {
    EHealthRecordCategory,
    ERecordSubject,
    EScanType,
} from "../../../../types/health-record.types";

const objectId = Joi.string().hex().length(24);

const subject = Joi.object({
    type: Joi.string()
        .valid(...Object.values(ERecordSubject))
        .required(),
    childId: Joi.when("type", {
        is: ERecordSubject.CHILD,
        then: objectId.required(),
        otherwise: Joi.valid(null).optional(),
    }),
});

export const healthRecordConsentValidator = Joi.object({
    consentVersion: Joi.string().max(40).required(),
});

export const createHealthRecordValidator = Joi.object({
    clientUploadId: Joi.string().uuid().required(),
    category: Joi.string()
        .valid(...Object.values(EHealthRecordCategory))
        .required(),
    scanType: Joi.when("category", {
        is: EHealthRecordCategory.SCAN,
        then: Joi.string()
            .valid(...Object.values(EScanType))
            .allow(null),
        otherwise: Joi.valid(null).optional(),
    }),
    subject: subject.required(),
});

/** Text fields that ride along with a multipart page. */
export const healthRecordFileFieldsValidator = Joi.object({
    clientUploadId: Joi.string().uuid().required(),
});

export const submitHealthRecordValidator = Joi.object({
    // The app sends its UI locale ("en", "hi", "hi-IN").
    lang: Joi.string().max(10).allow("", null),
});

export const updateHealthRecordValidator = Joi.object({
    category: Joi.string().valid(...Object.values(EHealthRecordCategory)),
    scanType: Joi.string()
        .valid(...Object.values(EScanType))
        .allow(null),
    subject,
}).min(1);

export const deleteHealthRecordsValidator = Joi.object({
    ids: Joi.array().items(objectId).min(1).max(50).unique().required(),
});

export const listHealthRecordsQueryValidator = Joi.object({
    cursor: Joi.string().max(200).allow(""),
    limit: Joi.number().integer().min(1).max(50),
    subject: Joi.string().valid(...Object.values(ERecordSubject)),
    childId: objectId,
    category: Joi.string().valid(...Object.values(EHealthRecordCategory)),
    // The app tags every request with its UI language.
    lang: Joi.string().max(10).allow(""),
});

export const generateHealthSummaryValidator = Joi.object({
    lang: Joi.string().max(10).allow("", null),
});
