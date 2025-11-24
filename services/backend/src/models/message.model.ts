import { model, Model } from "mongoose";
import { IMessage } from "../types/chat.types";
import messageSchema from "./schema/message.schema";

const messageModel: Model<IMessage> = model<IMessage>("messages", messageSchema);

export default messageModel;
