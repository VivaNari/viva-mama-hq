import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import sendErrorResponse from "../utils/commonFunctions/sendErrorResponse";

export const errorHandler = (
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    console.log("Error Middleware called");
    sendErrorResponse({
        error: error,
        errorMessage: error.message,
        response: response,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
};

export default errorHandler;
