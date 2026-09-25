import mongoose, { Model } from "mongoose";
import { ISubscription } from "../types/subscription.types";
import subscriptionSchema from "./schema/subscription.schema";

const subscriptionModel: Model<ISubscription> = mongoose.model<ISubscription>(
    "subscriptions",
    subscriptionSchema,
);

export default subscriptionModel;
