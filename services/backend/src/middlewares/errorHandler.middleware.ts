import { NextFunction, Request, Response } from "express";
import sendErrorResponse from "../utils/commonFunctions/sendErrorResponse";
import { messages } from "../constants/messages";
import { StatusCodes } from "http-status-codes";

export const errorHandler = (
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    console.log("Error Middleware called");
    sendErrorResponse({
        error: error,
        errorMessage: messages.INTERNAL_SERVER_ERROR,
        response: response,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
};

export default errorHandler;
