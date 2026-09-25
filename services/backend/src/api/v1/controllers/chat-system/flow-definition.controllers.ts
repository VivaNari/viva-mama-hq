import { NextFunction, Request, Response } from "express";
import FlowDefinitionService from "../../../../services/chat-system/flow-definition.service";
import { IFlowDefinition } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import {
    localizeFlowDefinition,
    resolveLanguage,
} from "../../../../utils/i18n/localizeFlowDefinition";

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

    /**
     * Return a single PUBLISHED flow definition by slug, localized to the
     * requested language (?lang=). Used by the app to render editable onboarding
     * answers (question text + option catalog) in the Edit Profile screen.
     */
    findBySlug = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const instance: IFlowDefinition | null = await this.flowDefinitionService.findOne({
                filter: { slug: request.params.slug, status: "PUBLISHED" },
            });

            if (!instance) {
                sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.FLOW_DEFINITION_NOT_FOUND,
                    response,
                });
                return;
            }

            const localized = localizeFlowDefinition(instance, resolveLanguage(request.query.lang));

            sendResponse({
                data: localized,
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
