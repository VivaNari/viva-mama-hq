import Joi from "joi";
import { IConsultationRequest } from "../../../../types/consultation.types";

const addConsultationRequestValidator = Joi.object<IConsultationRequest>({
    consultatorId: Joi.string().required(),
});

export default addConsultationRequestValidator;
