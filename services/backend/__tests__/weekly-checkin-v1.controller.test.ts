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

// Modules build their own child logger at import time via createModuleLogger, so the mock
// has to supply that factory too — returning a logger-shaped stub, since the result is
// what the module under test actually calls.
jest.mock("../src/utils/logger", () => {
    const stub = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        child: jest.fn(() => stub),
    };
    return {
        __esModule: true,
        default: stub,
        createChildLogger: jest.fn(() => stub),
        createModuleLogger: jest.fn(() => stub),
        createRequestLogger: jest.fn(() => stub),
        createUserLogger: jest.fn(() => stub),
        createWorkerLogger: jest.fn(() => stub),
    };
});

/**
 * The controller checks the user's check-in entitlement before starting one, which needs
 * both a flow-instance lookup and the entitlement service. Both are stubbed here so these
 * stay controller unit tests — the gate's own behaviour is covered against a real
 * database in entitlement.enforcement.test.ts.
 *
 * The lookup reads the instance's STATE, not merely whether a row exists. That
 * distinction is the whole fix: the week job pre-creates every check-in in PENDING, so an
 * existence check matched before the user had touched anything and the trial's
 * single-use quota was never spent. `null` here means "no row yet", which is also a new
 * check-in, so it spends the allowance.
 */
const flowInstanceFindOneMock = jest.fn().mockResolvedValue(null);
jest.mock("../src/models/flowInstance.model", () => ({
    __esModule: true,
    default: {
        findOne: (...args: unknown[]) => ({
            select: () => ({ lean: () => flowInstanceFindOneMock(...args) }),
        }),
    },
}));

const consumeCapabilityMock = jest.fn().mockResolvedValue({
    used: 1,
    limit: null,
    remaining: null,
});
const assertCapabilityMock = jest.fn().mockResolvedValue("PREMIUM");
jest.mock("../src/services/entitlements/entitlement.service", () => ({
    __esModule: true,
    entitlementService: {
        consumeCapability: (...args: unknown[]) => consumeCapabilityMock(...args),
        assertCapability: (...args: unknown[]) => assertCapabilityMock(...args),
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
        // clearAllMocks wipes the implementation too; restore the "no instance yet" default.
        flowInstanceFindOneMock.mockResolvedValue(null);
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

        /**
         * REGRESSION: this endpoint starts the onboarding questionnaire as well as the
         * weekly check-in. Gating it wholesale locked new users out of onboarding — which
         * they must finish before they can even choose a tier — with "weekly check-in is
         * a premium feature". Only `weekly-checkin-v1` may be gated.
         */
        it("does not consume a check-in entitlement for the onboarding flow", async () => {
            const payload: WeeklyCheckinResponse = {
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-onb",
                    week: 1,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 0, total: 3 },
                },
            };
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue(payload);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 1, flowSlug: "onboarding-flow-v2" },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(consumeCapabilityMock).not.toHaveBeenCalled();
            expect(assertCapabilityMock).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it("does gate the weekly check-in flow", async () => {
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue({
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 0, total: 3 },
                },
            } as WeeklyCheckinResponse);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5, flowSlug: WEEKLY_CHECKIN_SLUG },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.startCheckin(req, res);

            expect(assertCapabilityMock).toHaveBeenCalled();
        });

        /**
         * REGRESSION: the week job pre-creates every check-in in PENDING before the user
         * has touched it. The gate used to ask `flowInstance.exists({userId, week})`,
         * which that pre-created row satisfied — so `consumeCapability` was never called
         * on the normal path and the trial's one-check-in-per-period limit did nothing at
         * all. A trial user could do a check-in every week, indefinitely.
         */
        it("spends the allowance when the week job pre-created the check-in", async () => {
            flowInstanceFindOneMock.mockResolvedValue({ state: "PENDING" });
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue({
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 0, total: 3 },
                },
            } as WeeklyCheckinResponse);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5, flowSlug: WEEKLY_CHECKIN_SLUG },
            } as unknown as Request;

            await controller.startCheckin(req, createMockResponse());

            expect(consumeCapabilityMock).toHaveBeenCalled();
        });

        /**
         * The other half of the same fix: resuming a check-in she already started must
         * not bill her twice. Losing connection mid-flow cannot cost a trial user her
         * single allowance.
         */
        it("does not spend the allowance when resuming an ACTIVE check-in", async () => {
            flowInstanceFindOneMock.mockResolvedValue({ state: "ACTIVE" });
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue({
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 1, total: 3 },
                },
            } as WeeklyCheckinResponse);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5, flowSlug: WEEKLY_CHECKIN_SLUG },
            } as unknown as Request;

            await controller.startCheckin(req, createMockResponse());

            expect(assertCapabilityMock).toHaveBeenCalled();
            expect(consumeCapabilityMock).not.toHaveBeenCalled();
        });

        /**
         * The lookup must be scoped by flow slug. Onboarding instances also carry a
         * postpartumWeek, so an unscoped query could match one and skip the meter.
         */
        it("scopes the instance lookup to the check-in flow", async () => {
            weeklyCheckinServiceMocks.startCheckin.mockResolvedValue({
                success: true,
                message: "ok",
                data: {
                    flowInstanceId: "fi-1",
                    week: 5,
                    isCompleted: false,
                    nextQuestion: null,
                    progress: { answered: 0, total: 3 },
                },
            } as WeeklyCheckinResponse);
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: { week: 5, flowSlug: WEEKLY_CHECKIN_SLUG },
            } as unknown as Request;

            await controller.startCheckin(req, createMockResponse());

            expect(flowInstanceFindOneMock).toHaveBeenCalledWith(
                expect.objectContaining({ flowSlug: WEEKLY_CHECKIN_SLUG, postpartumWeek: 5 }),
            );
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

        it("returns 400 when no selection or freeText is provided", async () => {
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
                error: "Either selectedValues, selectedKeys or freeText must be provided",
            });
        });

        it("returns 400 when selectedValues is not an array", async () => {
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "n1",
                    week: 5,
                    selectedValues: "anemia",
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "selectedValues must be an array" });
        });

        it("forwards selectedValues to the service", async () => {
            weeklyCheckinServiceMocks.processAnswer.mockResolvedValue({ success: true });
            const req = {
                user: { _id: { toString: () => "user-1" } },
                body: {
                    flowInstanceId: "fi",
                    nodeId: "pregnancy_conditions",
                    week: 5,
                    selectedValues: ["anemia"],
                    selectedKeys: [0],
                },
            } as unknown as Request;
            const res = createMockResponse();

            await controller.processAnswer(req, res);

            expect(weeklyCheckinServiceMocks.processAnswer).toHaveBeenCalledWith(
                expect.objectContaining({ selectedValues: ["anemia"], selectedKeys: [0] }),
            );
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

            expect(weeklyCheckinServiceMocks.getCurrentState).toHaveBeenCalledWith(
                "user-1",
                5,
                undefined,
            );
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
