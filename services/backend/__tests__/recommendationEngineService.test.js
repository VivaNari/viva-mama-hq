"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Mock RecommendationModel.findOne BEFORE importing service
const mockFindOne = jest.fn();
jest.mock("../src/models/recommendation.model", () => ({
    __esModule: true,
    default: {
        findOne: (...args) => ({
            lean: () => mockFindOne(...args),
        }),
    },
}));
const recommendation_engine_service_1 = __importDefault(require("../src/services/recommendations/recommendation-engine.service"));
describe("RecommendationEngineService.getRecommendation", () => {
    beforeEach(() => {
        mockFindOne.mockReset();
    });
    it("returns category-specific recommendation for RED zone", async () => {
        const fakeRecommendation = {
            _id: "123",
            title: "Test Recommendation",
            goingWell: "All good",
            needsHelp: "Some issues",
            celebrate: "",
            tips: "",
            next: "",
        };
        // Mock DB return value for primary query
        mockFindOne.mockResolvedValueOnce(fakeRecommendation);
        const result = await recommendation_engine_service_1.default.getRecommendation(3, // week
        "RED", // zone
        "physical", // weakest category
        true);
        // Expectations
        expect(mockFindOne).toHaveBeenCalledTimes(1);
        expect(mockFindOne).toHaveBeenCalledWith({
            phase: "3-4",
            zone: "RED",
            category: "physical",
        });
        expect(result).toEqual(fakeRecommendation);
    });
});
//# sourceMappingURL=recommendationEngineService.test.js.map