import { model, Model } from "mongoose";
import { IConversation } from "../types/chat.types";
import conversationSchema from "./schema/conversation.schema";

const conversationModel: Model<IConversation> = model<IConversation>("conversations", conversationSchema);

export default conversationModel;