import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IExpert } from "../../types/expert.types";

const expertSchema: Schema<IExpert> = new Schema<IExpert>(
    {
        name: {
            type: String,
            required: true,
        },
        speciality: {
            type: String,
            required: true,
        },
        qualification: {
            type: String,
            required: true,
        },
        yearsOfExperience: {
            type: Number,
            required: true,
        },
        bio: {
            type: String,
            required: true,
        },
        photograph: {
            type: String,
            required: true,
        },
        remuneration: {
            type: Number,
            required: true,
        },
    },
    generalSchemaOptions,
);

export default expertSchema;
