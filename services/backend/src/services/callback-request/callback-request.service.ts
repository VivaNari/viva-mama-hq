import callbackRequestModel from "../../models/callback-request.model";
import { ICallbackRequest } from "../../types/callback-request.types";
import BaseService from "../base.service";

export class callbackRequestService extends BaseService<ICallbackRequest> {
    constructor() {
        super(callbackRequestModel);
    }
}
