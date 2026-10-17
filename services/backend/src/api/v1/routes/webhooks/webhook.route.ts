import { Router } from "express";
import { handlePlayRtdn } from "../../controllers/webhooks/play-rtdn.controller";
import { handleRazorpayWebhook } from "../../controllers/webhooks/razorpay-webhook.controller";
import pubsubPushMiddleware from "../../../../middlewares/pubsubPush.middleware";

const webhookRouter = Router();

/**
 * No authMiddleware: the HMAC signature over the raw body is the authentication.
 * Mounted under /api/v1/webhooks/ so the raw-body hook in app.ts applies.
 */
webhookRouter.post("/webhooks/razorpay", handleRazorpayWebhook);

/**
 * Google Play RTDN, pushed by Pub/Sub.
 *
 * Guarded by an OIDC check rather than a body signature, because Pub/Sub does not sign
 * payloads. This endpoint changes entitlements, so without that middleware anyone could
 * POST a "renewed" notification and extend their own subscription.
 */
webhookRouter.post("/webhooks/play/rtdn", pubsubPushMiddleware, handlePlayRtdn);

export default webhookRouter;
