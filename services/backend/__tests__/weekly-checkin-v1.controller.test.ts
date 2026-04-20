import { Request, Response } from "express";
import { WEEKLY_CHECKIN_SLUG } from "../src/constants/chat";
import {
    WeeklyCheckinErrorTypeEnum,
    WeeklyCheckinResponse,
} from "../src/types/weekly-checkin-v1.types";

const weeklyCheckinServiceMocks = {
    startCheckin: jest.fn(),
    processAnswer: jest.fn(),
    getCurrentState: jest.fn(),
    getCheckinStatus: jest.fn(),
};

jest.mock("../src/services/weekly-checkin-v1/weekly-checkin.service", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => weeklyCheckinServiceMocks),
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

import WeeklyCheckinController from "../src/api/v1/controllers/weekly-checkin-v1/weekly-checkin.controller";

/**
 * Builds a mock Express response whose `status` chains to `json` like Express.
 */
function createMockResponse(): Response {
    const res = {
        status: jest.fn(),
        json: jest.fn(),
    };
    (res.status as jest.Mock).mockReturnValue(res);
    return res as unknown as Response;
}

describe("WeeklyCheckinController", () => {
    let controller: WeeklyCheckinController;

    beforeAll(() => {
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new WeeklyCheckinController();
    });

    describe("startCheckin", () => {
        it("returns 401 when user is missing", async () => {
            const req = { body: { week: 5 }, user: undefined } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(weeklyCheckinServiceMocks.startCheckin).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
        });

        it("returns 400 when week is invalid", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 53 },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(weeklyCheckinServiceMocks.startCheckin).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Invalid week parameter. Must be between 1 and 52.",
            });
        });

        it("calls service with default flow slug and returns 200 on success", async () => {
            const payload: WeeklyCheckinResponse = {
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 0, total: 3 },
                },
            };
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5 },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(weeklyCheckinServiceMocks.startCheckin).toHaveBeenCalledWith({
                userId: "user-1",
                week: 5,
                flowSlug: WEEKLY_CHECKIN_SLUG,
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(payload);
        });

        it("passes custom flowSlug to the service", async () => {
            const payload: WeeklyCheckinResponse = {
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 2,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: null,
                },
            };
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 2, flowSlug: "custom-flow" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(weeklyCheckinServiceMocks.startCheckin).toHaveBeenCalledWith({
                userId: "user-1",
                week: 2,
                flowSlug: "custom-flow",
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it("returns 409 when service reports ALREADY_COMPLETED", async () => {
            const payload: WeeklyCheckinResponse = {
                success: false,
                message: "done",
                errorType: WeeklyCheckinErrorTypeEnum.ALREADY_COMPLETED,
            };
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 10 },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(payload);
        });

        it("returns 400 when service reports failure without ALREADY_COMPLETED", async () => {
            const payload: WeeklyCheckinResponse = {
                success: false,
                message: "bad",
                errorType: WeeklyCheckinErrorTypeEnum.FLOW_NOT_FOUND,
            };
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 10 },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(payload);
        });

        it("returns 500 when service throws", async () => {
            weeklyCheckinServiceMocks.startCheckin.mockRejectedValue(new Error("db"));
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 1 },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
        });
    });

    describe("processAnswer", () => {
        it("returns 401 when user is missing", async () => {
            const req = { body: {}, user: undefined } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("returns 400 when required body fields are missing", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5, selectedKeys: [1] },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing required fields: flowInstanceId, nodeId, and week are required",
            });
        });

        it("returns 400 when week is out of range", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 99,
                    selectedKeys: [1],
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Invalid week parameter" });
        });

        it("returns 400 when neither selectedKeys nor freeText is provided", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 5,
                    selectedKeys: [],
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Either selectedKeys or freeText must be provided",
            });
        });

        it("calls service and returns 200 on success", async () => {
            const payload: WeeklyCheckinResponse = {
                success: true,
                message: "saved",
                data: {
                    flowInstanceId: "fi",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 1, total: 3 },
                },
            };
            weeklyCheckinServiceMocks.processAnswer.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 5,
                    selectedKeys: [1],
                    idempotencyKey: "k1",
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).toHaveBeenCalledWith({
                userId: "user-1",
                flowInstanceId: "fi",
                nodeId: "n1",
                week: 5,
                selectedKeys: [1],
                freeText: undefined,
                idempotencyKey: "k1",
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(payload);
        });

        it("returns 400 when service reports failure", async () => {
            const payload: WeeklyCheckinResponse = {
                success: false,
                message: "invalid",
            };
            weeklyCheckinServiceMocks.processAnswer.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 5,
                    freeText: "hello",
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(payload);
        });

        it("returns 500 when service throws", async () => {
            weeklyCheckinServiceMocks.processAnswer.mockRejectedValue(new Error("boom"));
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 5,
                    freeText: "x",
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
        });
    });

    describe("getCurrentState", () => {
        it("returns 401 when user is missing", async () => {
            const req = { query: { week: "5" }, user: undefined } as unknown as Request;
            const res = createMockResponse();

            await controller.getCurrentState(req, res);

            expect(weeklyCheckinServiceMocks.getCurrentState).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("returns 400 when week query is invalid", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "0" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCurrentState(req, res);

            expect(weeklyCheckinServiceMocks.getCurrentState).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("returns 200 with service result", async () => {
            const state = {
                hasActiveCheckin: true,
                flowInstanceId: "fi",
                week: 5,
                state: "IN_PROGRESS",
                currentQuestion: null,
                progress: { answered: 1, total: 3 },
            };
            weeklyCheckinServiceMocks.getCurrentState.mockResolvedValue(state);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "5" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCurrentState(req, res);

            expect(weeklyCheckinServiceMocks.getCurrentState).toHaveBeenCalledWith("user-1", 5);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(state);
        });

        it("returns 500 when service throws", async () => {
            weeklyCheckinServiceMocks.getCurrentState.mockRejectedValue(new Error("db"));
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "3" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCurrentState(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
        });
    });

    describe("getCheckinStatus", () => {
        it("returns 401 when user is missing", async () => {
            const req = { query: { week: "5" }, user: undefined } as unknown as Request;
            const res = createMockResponse();

            await controller.getCheckinStatus(req, res);

            expect(weeklyCheckinServiceMocks.getCheckinStatus).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("returns 400 when week query is invalid", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "abc" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCheckinStatus(req, res);

            expect(weeklyCheckinServiceMocks.getCheckinStatus).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("returns 200 with service result", async () => {
            const status = {
                week: 5,
                hasCheckin: true,
                state: "DONE",
                isCompleted: true,
                isExpired: false,
                progress: null,
            };
            weeklyCheckinServiceMocks.getCheckinStatus.mockResolvedValue(status);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "5" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCheckinStatus(req, res);

            expect(weeklyCheckinServiceMocks.getCheckinStatus).toHaveBeenCalledWith("user-1", 5);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(status);
        });

        it("returns 500 when service throws", async () => {
            weeklyCheckinServiceMocks.getCheckinStatus.mockRejectedValue(new Error("db"));
            const req = {
                user: { _id: { toString: () => "user-1" } },
                query: { week: "1" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.getCheckinStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
        });
    });
});
