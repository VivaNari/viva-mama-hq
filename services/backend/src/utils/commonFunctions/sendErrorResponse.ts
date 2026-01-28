import { Response } from "express";
import { StatusCodes } from "http-status-codes";

const sendErrorResponse = ({
    error,
    errorMessage,
    success = false,
    response,
    statusCode,
}: {
    error: any;
    errorMessage: string;
    success?: false;
    response: Response;
    statusCode: StatusCodes;
}) => {
    response.status(statusCode).json({
        error,
        errorMessage,
        success,
        statusCode,
    });
};

export default sendErrorResponse;
