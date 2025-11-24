import flowDefintionModel from "../../models/flowDefinition.model";
import { IFlowDefinition } from "../../types/chat.types";
import BaseService from "../base.service";

class FlowDefinitionService extends BaseService<IFlowDefinition> {
    constructor() {
        super(flowDefintionModel);
    }
}

export default FlowDefinitionService;