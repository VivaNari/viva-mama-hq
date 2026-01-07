import consultationModel from "../../models/consultation.model";
import { IConsultationRequest } from "../../types/consultation.types";
import BaseService from "../base.service";

export class ConsultationService extends BaseService<IConsultationRequest> {
    constructor() {
        super(consultationModel);
    }
}
