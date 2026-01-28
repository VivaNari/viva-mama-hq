import { NextFunction, Request, Response } from "express";
import { IFlowNodeCategory } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import FlowNodeCategoryService from "../../../../services/chat-system/flow-definition-category.service";
import { messages } from "../../../../constants/messages";

class FlowNodeController {
    private flowNodeCategoryService: FlowNodeCategoryService;

    constructor() {
        this.flowNodeCategoryService = new FlowNodeCategoryService();
    }

    create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instance: IFlowNodeCategory = await this.flowNodeCategoryService.create(
                request.body,
            );
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.FLOW_NODE_CATEGORY_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    find = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instances: IFlowNodeCategory[] = await this.flowNodeCategoryService.find(
                request.body,
            );
            sendResponse({
                data: instances,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FLOW_NODE_CATEGORY_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}

export default FlowNodeController;
