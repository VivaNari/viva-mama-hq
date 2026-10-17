import { Schema } from "mongoose";
import { IFlowDefinition } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowDefinitionSchema: Schema<IFlowDefinition> = new Schema<IFlowDefinition>(
    {
        slug: String,
        name: String,
        version: Number,
        status: String,
        reminderIntervalMins: Number,
        notificationTemplates: [
            {
                notificationType: String,
                title: String,
                body: String,
            },
        ],
        startNodeId: String,
        nodes: [
            {
                id: String,
                categoryId: Schema.Types.ObjectId,
                indicator: String,
                nodeType: String,
                text: String,
                educationalMessage: String,
                whyThisMatters: String,
                validWeekStart: Number,
                validWeekEnd: Number,
                options: [
                    {
                        key: String,
                        label: String,
                        value: Schema.Types.Mixed,
                        score: {
                            type: Number,
                            null: true,
                        },
                    },
                ],
                branch: {
                    type: [
                        {
                            when: { var: String, op: String, val: String },
                            goTo: String,
                        },
                    ],
                    default: null,
                },
                calc: {
                    type: [{ set: String, expr: String }],
                    default: null,
                },
                next: {
                    type: String,
                    default: null,
                },
            },
        ],
        outcomes: [
            {
                key: String,
                title: String,
                summary: String,
                recommendations: [String],
                nextAction: {
                    type: String,
                    default: null,
                },
            },
        ],
        // i18n translation bundles keyed by language code (e.g. "hi").
        // Holds ONLY translatable display strings; structural/logic fields
        // (ids, option values, scores, branch, calc, next) live in the base
        // document and are never duplicated here. Missing keys fall back to
        // the base (English) content. See utils/i18n/localizeFlowDefinition.
        translations: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    generalSchemaOptions,
);

export default flowDefinitionSchema;
