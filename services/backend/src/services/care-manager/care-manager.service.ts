import caremanagerModel from "../../models/care-manager.model";
import { ICareManager } from "../../types/care-manager.types";
import BaseService from "../base.service";

export class CareManagerService extends BaseService<ICareManager> {
    constructor() {
        super(caremanagerModel);
    }
}
