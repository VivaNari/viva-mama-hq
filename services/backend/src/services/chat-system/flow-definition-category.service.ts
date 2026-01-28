import flowDefinitionCategory from "../../models/flowNodeCategory";
import { IFlowNodeCategory } from "../../types/chat.types";
import BaseService from "../base.service";

class FlowNodeCategoryService extends BaseService<IFlowNodeCategory> {
    constructor() {
        super(flowDefinitionCategory);
    }
}

export default FlowNodeCategoryService;
