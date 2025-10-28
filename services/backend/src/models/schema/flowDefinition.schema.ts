import { Schema } from "mongoose";
import { IFlowDefinition } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowDefinitionSchema: Schema<IFlowDefinition> = new Schema<IFlowDefinition>(
    {
        slug: String,
        name: String,
        version: Number,
        status: String,
        startNodeId: String,
        nodes: [
            {
                id: String,
                type1: String,
                text: String,
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
