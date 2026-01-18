import { Schema } from "mongoose";
import { IBookmark } from "../../types/ai-message-bookmark.types";
import { generalSchemaOptions } from "../../constants/model";

const aiMessageBookmarkSchema = new Schema<IBookmark>(
    {
        messageId: {
            type: Schema.Types.ObjectId,
            ref: "messages",
        },
        userId: Schema.Types.ObjectId,
    },
    generalSchemaOptions,
);

export default aiMessageBookmarkSchema;
