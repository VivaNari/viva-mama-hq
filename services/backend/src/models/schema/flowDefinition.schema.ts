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
    },
    generalSchemaOptions,
);

export default flowDefinitionSchema;
