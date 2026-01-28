import flowResponseModel from "../../models/flowResponse.model";
import { IFlowResponse } from "../../types/chat.types";
import BaseService from "../base.service";

class FlowResponseService extends BaseService<IFlowResponse> {
    constructor() {
        super(flowResponseModel);
    }
}

export default FlowResponseService;
