import { Router } from "express";

import SubscriptionController from "../../controllers/subscription/subscription.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import {
    createCheckoutValidator,
    reconcileCheckoutValidator,
    verifyCheckoutValidator,
    verifyPlayPurchaseValidator,
} from "../../validators/subscription/subscription.validator";

const subscriptionRouter = Router();
const subscriptionController = new SubscriptionController();

subscriptionRouter.get("/subscription/me", authMiddleware("header"), subscriptionController.getMe);

subscriptionRouter.get(
    "/subscription/plans",
    authMiddleware("header"),
    subscriptionController.getPlans,
);

// No body: the trial is not tied to a plan, and its length comes from
// TRIAL_DURATION_DAYS rather than anything the client sends.
subscriptionRouter.post(
    "/subscription/trial/start",
    authMiddleware("header"),
    subscriptionController.startTrial,
);

// Replaces /subscribe/select-free-plan, which took a free-text plan name and billing
// cycle it then wrote verbatim into the user document.
subscriptionRouter.post(
    "/subscription/free/select",
    authMiddleware("header"),
    subscriptionController.selectFree,
);

subscriptionRouter.post(
    "/subscription/checkout/create",
    authMiddleware("header"),
    requestValidator(createCheckoutValidator),
    subscriptionController.createCheckout,
);

subscriptionRouter.post(
    "/subscription/checkout/verify",
    authMiddleware("header"),
    requestValidator(verifyCheckoutValidator),
    subscriptionController.verifyCheckout,
);

// Fallback for a captured payment whose client callback never fired. Safe to call even
// when the happy path already activated — it is idempotent.
subscriptionRouter.post(
    "/subscription/checkout/reconcile",
    authMiddleware("header"),
    requestValidator(reconcileCheckoutValidator),
    subscriptionController.reconcileCheckout,
);

// Google Play rail. There is no create step to pair with this: the purchase begins and
// completes inside Google Play, and the server first hears about it here.
//
// Safe to call repeatedly — the client retries after a network failure, and RTDN can
// report the same purchase independently.
subscriptionRouter.post(
    "/subscription/play/verify",
    authMiddleware("header"),
    requestValidator(verifyPlayPurchaseValidator),
    subscriptionController.verifyPlayPurchase,
);

subscriptionRouter.post(
    "/subscription/cancel",
    authMiddleware("header"),
    subscriptionController.cancel,
);

export default subscriptionRouter;
