// Mock RecommendationModel.findOne BEFORE importing service
const mockFindOne = jest.fn();

jest.mock("../src/models/recommendation.model", () => ({
    __esModule: true,
    default: {
        findOne: (...args: any[]) => ({
            lean: () => mockFindOne(...args),
        }),
    },
}));

import RecommendationEngineService from "../src/services/recommendations/recommendation-engine.service";

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

        const dummyScore = { score: 5, zone: "YELLOW" as const };
        const result = await RecommendationEngineService.getRecommendation(
            3, // week
            "RED", // zone
            "physical", // weakest category
            true, // breastfeeding
            dummyScore,
            dummyScore,
            dummyScore,
        );

        // Expectations
        expect(mockFindOne).toHaveBeenCalledTimes(4);
        expect(mockFindOne).toHaveBeenCalledWith({
            phase: "3-4",
            zone: "RED",
            category: "physical",
        });

        expect(result.overall).toEqual(fakeRecommendation);
    });
});
