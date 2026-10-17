import subscriptionPlanModel from "../../models/subscription-plan.model";
import { EPlanCode, ISubscriptionPlan } from "../../types/subscription.types";
import BaseService from "../base.service";

/**
 * Read access to the plan catalog.
 *
 * Nothing in the codebase may hardcode a price or a credit count — they live in
 * `subscription_plans` so a pricing change is a database update, not an app release.
 */
export class SubscriptionPlanService extends BaseService<ISubscriptionPlan> {
    constructor() {
        super(subscriptionPlanModel);
    }

    /** Active plans in display order. */
    public async listActive(): Promise<ISubscriptionPlan[]> {
        return this.find({
            filter: { isActive: true },
            sort: { sortOrder: 1 },
        });
    }

    /**
     * Resolve a plan by code. Every checkout must go through this rather than trusting
     * a client-supplied amount — the current endpoint takes `amount` straight from the
     * request body, which lets a client buy a ₹1,499 plan for ₹1.
     */
    public async getByCode(code: EPlanCode): Promise<ISubscriptionPlan | null> {
        const [plan] = await this.find({ filter: { code, isActive: true } });
        return plan ?? null;
    }
}

export const subscriptionPlanService = new SubscriptionPlanService();
