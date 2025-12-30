import { NextFunction, Request, Response } from "express";
import { callbackRequestService } from "../../../../services/callback-request/callback-request.service";
import { messages } from "../../../../constants/messages";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import caremanagerModel from "../../../../models/care-manager.model";
import { sendWhatsAppMessage } from "../../../../services/twilio/sendSMS";

export class CallbackRequestController {
    private callbackRequestService: callbackRequestService = new callbackRequestService();
    constructor() {
        this.callbackRequestService = new callbackRequestService();
    }
    requestCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            console.log("In callback request controller-=--------------======>", request.body);
            const { userId, careManagerId } = request.body;
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }
            console.log("careManagerId------>", careManagerId);

            const careManagerInstance = await caremanagerModel.findById(careManagerId);

            if (!careManagerInstance) {
                throw new Error(messages.CARE_MANAGER_NOT_FOUND);
            }

            console.log("nskdjnk------------->", careManagerInstance);
            const payload = {
                ...request.body,
                requestStatus: "PENDING",
            };

            // const instance: IProduct = await this.productService.create(request.body);
            const instance = await this.callbackRequestService.create(payload);

            // Send WhatsApp message
            const message = `📞 *New Callback Request*

            *Care Manager:* ${careManagerInstance.name}
            *User ID:* ${request.user.email}
            *Requested At:* ${new Date().toLocaleString()}

            Please respond as soon as possible.`;

            try {
                console.log("care manager instanse", careManagerInstance);
                await sendWhatsAppMessage(careManagerInstance.phoneNumber, message);
            } catch (err) {
                console.error("WhatsApp failed (ignored)", err);
            }
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONTENT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
