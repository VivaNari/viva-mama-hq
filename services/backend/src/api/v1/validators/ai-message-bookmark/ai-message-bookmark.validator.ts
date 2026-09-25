import Joi from "joi";
import { IBookmark } from "../../../../types/ai-message-bookmark.types";

/**
 * `messageId` is constrained to an ObjectId's shape, not just "a string".
 *
 * The controller now looks the message up to check it belongs to the caller, and
 * `findById` on a value Mongoose cannot cast throws rather than returning null — which
 * would turn a malformed id into a 500 instead of the refusal it should be.
 */
const aiMessageBookmarkValidator = Joi.object<IBookmark>({
    messageId: Joi.string().hex().length(24).required(),
});

export default aiMessageBookmarkValidator;
