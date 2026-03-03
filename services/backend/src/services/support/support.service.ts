import supportModel from "../../models/support.model";
import { ISupport } from "../../types/support-schema.types";
import BaseService from "../base.service";

export class SupportService extends BaseService<ISupport> {
    constructor() {
        super(supportModel);
    }
}
