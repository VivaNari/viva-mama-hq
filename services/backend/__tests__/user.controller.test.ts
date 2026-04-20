import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../src/constants/messages";

const userServiceMocks = {
    getUserbyAuthToken: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    sendOTPToPhone: jest.fn(),
    verifyOTP: jest.fn(),
    googleAuth: jest.fn(),
    findByIdAndPartialUpdate: jest.fn(),
};

jest.mock("../src/services/users/user.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => userServiceMocks),
}));

jest.mock("../src/services/recommendations/recommendation-history.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        find: jest.fn(),
    })),
}));

jest.mock("../src/models/recommendation-history.model", () => ({
    __esModule: true,
    default: {},
}));

jest.mock("../src/models/user.model", () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
    },
}));

jest.mock("../src/utils/commonFunctions/sendResponse", () => ({
    __esModule: true,
    default: jest.fn(),
}));

import UserController from "../src/api/v1/controllers/users/user.controller";
import sendResponse from "../src/utils/commonFunctions/sendResponse";

const mockedSendResponse = jest.mocked(sendResponse);

describe("UserController", () => {
    let controller: UserController;

    beforeAll(() => {
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new UserController();
    });

    describe("getUserbyAuthToken", () => {
        it("delegates to userService.getUserbyAuthToken", async () => {
            userServiceMocks.getUserbyAuthToken.mockResolvedValue(undefined);
            const req = {} as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.getUserbyAuthToken(req, res, next);

            expect(userServiceMocks.getUserbyAuthToken).toHaveBeenCalledWith(req, res);
            expect(next).not.toHaveBeenCalled();
        });

        it("calls next when userService throws", async () => {
            const err = new Error("service failure");
            userServiceMocks.getUserbyAuthToken.mockRejectedValue(err);
            const req = {} as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.getUserbyAuthToken(req, res, next);

            expect(next).toHaveBeenCalledWith(err);
        });
    });

    describe("updateFCMToken", () => {
        it("calls next when req.user is missing", async () => {
            const req = { body: { FCM_token: "token" } } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateFCMToken(req, res, next);

            expect(userServiceMocks.findByIdAndUpdate).not.toHaveBeenCalled();
            expect(mockedSendResponse).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(expect.any(Error));
            const passed = (next.mock.calls[0] as [Error])[0];
            expect(passed.message).toBe(messages.USER_FETCH_FAILED);
        });

        it("updates FCM token and sends success response", async () => {
            const updatedUser = { _id: "u1", FCM_token: "new-token" };
            userServiceMocks.findByIdAndUpdate.mockResolvedValue(updatedUser);
            const req = {
                user: { _id: "u1" },
                body: { FCM_token: "new-token" },
            } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateFCMToken(req, res, next);

            expect(userServiceMocks.findByIdAndUpdate).toHaveBeenCalledWith({
                _id: "u1",
                payload: { FCM_token: "new-token" },
            });
            expect(mockedSendResponse).toHaveBeenCalledWith({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FCM_TOKEN_UPDATED_SUCCESS,
                response: res,
            });
            expect(next).not.toHaveBeenCalled();
        });

        it("calls next when findByIdAndUpdate throws", async () => {
            const err = new Error("db error");
            userServiceMocks.findByIdAndUpdate.mockRejectedValue(err);
            const req = {
                user: { _id: "u1" },
                body: { FCM_token: "t" },
            } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateFCMToken(req, res, next);

            expect(next).toHaveBeenCalledWith(err);
        });
    });

    describe("sendOTPToPhone", () => {
        it("delegates to userService.sendOTPToPhone", async () => {
            userServiceMocks.sendOTPToPhone.mockResolvedValue(undefined);
            const req = {} as Request;
            const res = {} as Response;

            await controller.sendOTPToPhone(req, res);

            expect(userServiceMocks.sendOTPToPhone).toHaveBeenCalledWith(req, res);
        });
    });

    describe("verifyOTP", () => {
        it("delegates to userService.verifyOTP", async () => {
            userServiceMocks.verifyOTP.mockResolvedValue(undefined);
            const req = {} as Request;
            const res = {} as Response;

            await controller.verifyOTP(req, res);

            expect(userServiceMocks.verifyOTP).toHaveBeenCalledWith(req, res);
        });
    });

    describe("googleAuth", () => {
        it("delegates to userService.googleAuth", async () => {
            userServiceMocks.googleAuth.mockResolvedValue(undefined);
            const req = {} as Request;
            const res = {} as Response;

            await controller.googleAuth(req, res);

            expect(userServiceMocks.googleAuth).toHaveBeenCalledWith(req, res);
        });
    });

    describe("updateUserData", () => {
        it("calls next when req.user is missing", async () => {
            const req = { body: { name: "A" } } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateUserData(req, res, next);

            expect(userServiceMocks.findByIdAndPartialUpdate).not.toHaveBeenCalled();
            expect(mockedSendResponse).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(expect.any(Error));
            const passed = (next.mock.calls[0] as [Error])[0];
            expect(passed.message).toBe(messages.USER_FETCH_FAILED);
        });

        it("partially updates user and sends success response", async () => {
            const updatedUser = { _id: "u1", name: "Updated" };
            userServiceMocks.findByIdAndPartialUpdate.mockResolvedValue(updatedUser);
            const payload = { name: "Updated" };
            const req = {
                user: { _id: "u1" },
                body: payload,
            } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateUserData(req, res, next);

            expect(userServiceMocks.findByIdAndPartialUpdate).toHaveBeenCalledWith({
                _id: "u1",
                payload,
            });
            expect(mockedSendResponse).toHaveBeenCalledWith({
                data: updatedUser,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.USER_UPDATED_SUCCESS,
                response: res,
            });
            expect(next).not.toHaveBeenCalled();
        });

        it("calls next when findByIdAndPartialUpdate throws", async () => {
            const err = new Error("update failed");
            userServiceMocks.findByIdAndPartialUpdate.mockRejectedValue(err);
            const req = {
                user: { _id: "u1" },
                body: {},
            } as unknown as Request;
            const res = {} as Response;
            const next = jest.fn() as NextFunction;

            await controller.updateUserData(req, res, next);

            expect(next).toHaveBeenCalledWith(err);
        });
    });
});
