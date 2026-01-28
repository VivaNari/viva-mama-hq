import { Schema } from "mongoose";
import { ConsultationTypeEnum, IConsultationRequest } from "../../types/consultation.types";
import { generalSchemaOptions } from "../../constants/model";

const consultationSchema = new Schema<IConsultationRequest>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        consultationType: {
            type: String,
            enum: Object.values(ConsultationTypeEnum),
            required: true,
        },
        consultatorId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: function (this: IConsultationRequest) {
                if (this.consultationType === ConsultationTypeEnum.CARE_MANAGER)
                    return "care_managers";
                return "experts";
            },
        },
        requestStatus: {
            type: String,
            enum: ["PENDING", "COMPLETED", "UNHANDLED"],
            default: null,
        },
    },
    generalSchemaOptions,
);

export default consultationSchema;
