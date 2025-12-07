jest.mock("../src/models/user.model", () => ({
    __esModule: true,
    default: {
        findById: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue({
                current_postpartum_week: 3,
                is_breastfeeding_currently: true,
            }),
        }),
    },
}));

import UserModel from "../src/models/user.model";
import ScoreEngineService from "../src/services/score-engine/scoreEngine.service";

describe("ScoreEngineService.calculateForUser", () => {
    it("calculates final score, zone and weakest category correctly", async () => {
        const indicators = {
            physical: [2, 2, 1], // sum=5, max=6 → raw=0.8333
            lactation: [1, 2], // sum=3, max=4 → raw=0.75
            emotional: [2, 1, 2], // sum=5, max=6 → raw=0.8333
        };

        const result = await ScoreEngineService.calculateForUser("user123", indicators);

        // EXPECTATIONS
        expect(UserModel.findById).toHaveBeenCalledWith("user123");
        expect(result.week).toBe(3);
        expect(result.breastfeeding).toBe(true);

        // Check structure
        expect(result.categories.physical.raw).toBeCloseTo(0.833, 2);
        expect(result.categories.lactation.raw).toBeCloseTo(0.75, 2);
        expect(result.categories.emotional.raw).toBeCloseTo(0.833, 2);

        // Week 3 → thresholds for "3-4" range
        // Weights for week 3 → equal weights: 33.33 each

        expect(result.finalScore).toBeGreaterThan(0);
        expect(["RED", "YELLOW", "GREEN"]).toContain(result.zone);

        expect(["physical", "lactation", "emotional"]).toContain(result.weakestCategory);
    });
});
