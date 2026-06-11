import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { BecknError } from "../../../types/beckn.types";

// Beckn synchronous responses use the protocol envelope { message: { ack: { status } } } —
// NOT the app's standard { data, message, success } shape. BAPs and the ONIX adapter expect
// this exact structure, so Beckn handlers must use these helpers, not sendResponse.

export const sendBecknAck = (response: Response) => {
    response.status(StatusCodes.OK).json({
        message: { ack: { status: "ACK" } },
    });
};

export const sendBecknNack = (
    response: Response,
    error: BecknError,
    statusCode: StatusCodes = StatusCodes.OK,
) => {
    response.status(statusCode).json({
        message: { ack: { status: "NACK" } },
        error,
    });
};
