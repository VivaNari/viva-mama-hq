import { NextFunction, Request, Response } from "express";
import FlowDefinitionService from "../../../../services/chat-system/flow-definition.service";
import { IFlowDefinition } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";

class FlowDefinitionController {
    private flowDefinitionService: FlowDefinitionService;

    constructor() {
        this.flowDefinitionService = new FlowDefinitionService();
    }

    create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instance: IFlowDefinition = await this.flowDefinitionService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.FLOW_DEFINITION_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    find = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instances: IFlowDefinition[] = await this.flowDefinitionService.find(
                request.body,
            );
            sendResponse({
                data: instances,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FLOW_DEFINITION_RETRIEVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}

export default FlowDefinitionController;
