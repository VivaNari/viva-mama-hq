/**
 * Who is shown the "feeding" onboarding question.
 *
 * This exercises weekly-checkin-v1/flow.service.ts, which is the engine the APP actually
 * runs onboarding through (POST /chat/checkin/{start,answer}). It gates on node
 * `indicator` against NP_WOMEN_INDICATORS / NN_WOMEN_INDICATORS.
 *
 * ChatFlowService expresses the same rules by node `id` for the websocket path. These
 * tests exist because that distinction was missed once already: the id lists were updated
 * and the indicator lists were not, so an NP user was still shown the question.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import FlowService from "../src/services/weekly-checkin-v1/flow.service";
import { NN_WOMEN_INDICATORS, NP_WOMEN_INDICATORS } from "../src/constants/chat";
import { EUserCategory, IUser } from "../src/types/user.types";
import { IFlowNode } from "../src/types/chat.types";

const service = new FlowService();

/** The node as the migration writes it — the indicator is what the gate reads. */
const feedingNode = { id: "feeding", indicator: "Feeding Method" } as IFlowNode;
const neutralNode = { id: "smoking", indicator: "Tobacco Use" } as IFlowNode;

const isNP = (c: EUserCategory) => c === EUserCategory.NP;
const isNN = (c: EUserCategory) => c === EUserCategory.NN;

/** Both category gates, the way checkNodeEligibility applies them. */
const visibleTo = (node: IFlowNode, category: EUserCategory): boolean =>
    service.isNodeValidForNPWomen(node, isNP(category)).isEligible &&
    service.isNodeValidForNNWomen(node, isNN(category)).isEligible;

describe("feeding question visibility (live onboarding engine)", () => {
    it("is shown to postpartum mothers", () => {
        expect(visibleTo(feedingNode, EUserCategory.PP)).toBe(true);
    });

    // The reported bug: a user with a future delivery date saw the question.
    it("is hidden from pregnant (NP) users", () => {
        expect(visibleTo(feedingNode, EUserCategory.NP)).toBe(false);
    });

    it("is hidden from not-pregnant (NN) users", () => {
        expect(visibleTo(feedingNode, EUserCategory.NN)).toBe(false);
    });

    it("does not disturb questions everyone should see", () => {
        for (const category of [EUserCategory.PP, EUserCategory.NP, EUserCategory.NN]) {
            expect(visibleTo(neutralNode, category)).toBe(true);
        }
    });

    it("gates on the exact indicator the migration writes", () => {
        expect(NP_WOMEN_INDICATORS).toContain("Feeding Method");
        expect(NN_WOMEN_INDICATORS).toContain("Feeding Method");
    });

    /**
     * The indicator lists and the id lists in ChatFlowService are two spellings of one
     * rule. Nothing enforces that at runtime, so it is asserted here.
     */
    it("keeps the delivery questions gated for NP as before", () => {
        const deliveryType = { id: "delivery_type", indicator: "Delivery Type" } as IFlowNode;
        const deliveryOutcome = {
            id: "delivery_outcome",
            indicator: "Delivery Outcome",
        } as IFlowNode;

        expect(visibleTo(deliveryType, EUserCategory.NP)).toBe(false);
        expect(visibleTo(deliveryOutcome, EUserCategory.NP)).toBe(false);
        expect(visibleTo(deliveryType, EUserCategory.PP)).toBe(true);
    });
});

describe("checkNodeEligibility end to end", () => {
    const flowInstance = { _id: "000000000000000000000001" } as any;

    const user = (category: EUserCategory) =>
        ({
            _id: "000000000000000000000002",
            user_category: category,
            is_breastfeeding_currently: true,
        }) as unknown as IUser;

    it("refuses the feeding node for an NP user through the full check", async () => {
        const result = await service.checkNodeEligibility(
            feedingNode,
            user(EUserCategory.NP),
            flowInstance,
            35,
        );

        expect(result.isEligible).toBe(false);
        expect(result.reason).toContain("Feeding Method");
    });

    it("allows it for a PP user through the full check", async () => {
        const result = await service.checkNodeEligibility(
            feedingNode,
            user(EUserCategory.PP),
            flowInstance,
            3,
        );

        expect(result.isEligible).toBe(true);
    });
});
