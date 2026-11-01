import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { singleAttachmentUpload } from "../../../../middlewares/upload.middleware";
import ChatAttachmentController, {
    requireAttachmentFeature,
} from "../../controllers/chat-system/chat-attachment.controller";
import { attachmentConsentValidator } from "../../validators/chat-attachments/chat-attachment.validator";

/** Reports, scans and prescriptions she attaches in Viva AI chat. */
const chatAttachmentRouter = Router();
const controller = new ChatAttachmentController();

chatAttachmentRouter.get(
    "/chat/attachments/config",
    authMiddleware("header"),
    controller.getConfig,
);

chatAttachmentRouter.post(
    "/chat/attachments/consent",
    authMiddleware("header"),
    requireAttachmentFeature,
    requestValidator(attachmentConsentValidator),
    controller.acceptConsent,
);

// Auth and the feature gate run before multer, so nobody's bytes are buffered until
// we know the upload is allowed.
chatAttachmentRouter.post(
    "/chat/attachments",
    authMiddleware("header"),
    requireAttachmentFeature,
    singleAttachmentUpload,
    controller.upload,
);

chatAttachmentRouter.get("/chat/attachments/:id/url", authMiddleware("header"), controller.getUrl);

chatAttachmentRouter.delete("/chat/attachments/:id", authMiddleware("header"), controller.remove);

export default chatAttachmentRouter;
