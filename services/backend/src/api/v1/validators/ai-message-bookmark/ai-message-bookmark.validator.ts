import Joi from "joi";
import { IBookmark } from "../../../../types/ai-message-bookmark.types";

const aiMessageBookmarkValidator = Joi.object<IBookmark>({
    messageId: Joi.string().required(),
});

export default aiMessageBookmarkValidator;
