import mongoose, { Model } from "mongoose";
import { ISubscriptionPlan } from "../types/subscription.types";
import subscriptionPlanSchema from "./schema/subscription-plan.schema";

const subscriptionPlanModel: Model<ISubscriptionPlan> = mongoose.model<ISubscriptionPlan>(
    "subscription_plans",
    subscriptionPlanSchema,
);

export default subscriptionPlanModel;
