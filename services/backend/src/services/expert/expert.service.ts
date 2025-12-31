import expertModel from "../../models/expert.model";
import { IExpert } from "../../types/expert.types";
import BaseService from "../base.service";

export class ExpertService extends BaseService<IExpert> {
    constructor() {
        super(expertModel);
    }
}
