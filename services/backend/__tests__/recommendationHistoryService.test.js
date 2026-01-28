"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mockCreate = jest.fn();
const mockFind = jest.fn();
const mockFindOne = jest.fn();
jest.mock("../src/models/recommendation-history.model", () => ({
    __esModule: true,
    default: {
        create: (...args) => mockCreate(...args),
        find: (...args) => {
            mockFind(...args);
            return {
                sort: () => ({
                    limit: () => ({
                        populate: () => ({
                            lean: () => mockFind.mock.results.at(-1)?.value,
                        }),
                    }),
                }),
            };
        },
        findOne: (...args) => {
            mockFindOne(...args);
            return {
                sort: () => ({
                    populate: () => ({
                        lean: () => mockFindOne.mock.results.at(-1)?.value,
                    }),
                }),
            };
        },
    },
}));
// ---- Silence console logs ONLY for this test file ----
jest.spyOn(console, "log").mockImplementation(() => { });
jest.spyOn(console, "error").mockImplementation(() => { });
const recommendation_history_service_1 = __importDefault(require("../src/services/recommendations/recommendation-history.service"));
describe("RecommendationHistoryService", () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockFind.mockReset();
        mockFindOne.mockReset();
    });
    // ---------------------------------------------------------
    it("create() saves history", async () => {
        const fakeHistory = { _id: "H1" };
        mockCreate.mockResolvedValueOnce(fakeHistory);
        const payload = {
            userId: "U1",
            week: 3,
            finalScore: 85,
            zone: "GREEN",
            weakestCategory: "emotional",
            breastfeeding: true,
            recommendationId: "R1",
            categoryScores: {
                physical: { raw: 0.2, weighted: 5 },
                lactation: { raw: 0.3, weighted: 10 },
                emotional: { raw: 0.9, weighted: 40 },
            },
        };
        const result = await recommendation_history_service_1.default.create(payload);
        expect(mockCreate).toHaveBeenCalledWith(payload);
        expect(result).toEqual(fakeHistory);
    });
    // ---------------------------------------------------------
    it("create() throws when DB fails", async () => {
        mockCreate.mockRejectedValueOnce(new Error("DB create failed"));
        await expect(recommendation_history_service_1.default.create({
            userId: "U1",
            week: 3,
            finalScore: 85,
            zone: "GREEN",
            weakestCategory: "emotional",
            breastfeeding: true,
            recommendationId: "R1",
            categoryScores: {
                physical: { raw: 0.2, weighted: 5 },
                lactation: { raw: 0.3, weighted: 10 },
                emotional: { raw: 0.9, weighted: 40 },
            },
        })).rejects.toThrow("DB create failed");
    });
    // ---------------------------------------------------------
    it("getUserHistory() returns array", async () => {
        const fakeList = [{ _id: "1" }, { _id: "2" }];
        mockFind.mockReturnValueOnce(fakeList);
        const result = await recommendation_history_service_1.default.getUserHistory("U1", 2);
        expect(mockFind).toHaveBeenCalledWith({ userId: "U1" });
        expect(result).toEqual(fakeList);
    });
    // ---------------------------------------------------------
    it("getHistoryByWeek() returns single record", async () => {
        const fakeRecord = { _id: "W1", week: 3 };
        mockFindOne.mockReturnValueOnce(fakeRecord);
        const result = await recommendation_history_service_1.default.getHistoryByWeek("U1", 3);
        expect(mockFindOne).toHaveBeenCalledWith({ userId: "U1", week: 3 });
        expect(result).toEqual(fakeRecord);
    });
});
//# sourceMappingURL=recommendationHistoryService.test.js.map