import { Response } from "express";

const sendResponse = (
    { data, totalCount, message, success, response, statusCode }: 
    { data: any; totalCount?: number; message: string; success: boolean; response: Response; statusCode: number }
    ) => {
    response.status(statusCode).json({
        data,
        totalCount,
        message,
        success,
        response, 
        statusCode
    });
}

export default sendResponse;