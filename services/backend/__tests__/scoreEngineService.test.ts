jest.mock("../src/models/user.model", () => ({
    __esModule: true,
    default: {
        findById: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue({
                current_weekdays: { weeks: 3 },
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

    /**
     * The week decides the threshold band, the category weights, and the week the result
     * is filed under. Reading it from `user.current_weekdays` attributed the score to
     * whenever this job happened to run rather than to the week being reported on — so a
     * check-in finished just before a week rollover was graded on the next week's
     * thresholds and stored under the wrong week.
     */
    it("scores against the week the check-in was FOR, not the user's current week", async () => {
        const indicators = {
            physical: [2, 2, 1],
            lactation: [1, 2],
            emotional: [2, 1, 2],
        };

        // The mocked user is in week 3; the check-in belongs to week 9.
        const result = await ScoreEngineService.calculateForUser("user123", indicators, 9);

        expect(result.week).toBe(9);
    });

    it("falls back to the user's current week when no instance week is given", async () => {
        const indicators = { physical: [2], lactation: [2], emotional: [2] };

        const result = await ScoreEngineService.calculateForUser("user123", indicators);

        expect(result.week).toBe(3);
    });
});
