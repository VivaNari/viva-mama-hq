import Joi from "joi";
import { IConsultationRequest } from "../../../../types/consultation.types";

const addConsultationRequestValidator = Joi.object<IConsultationRequest>({
    consultatorId: Joi.string().required(),
    preferred_consultation_date: Joi.date().required(),
});

export default addConsultationRequestValidator;
