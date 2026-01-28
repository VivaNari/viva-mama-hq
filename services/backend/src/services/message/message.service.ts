import messageModel from "../../models/message.model";
import { IMessage } from "../../types/chat.types";
import BaseService from "../base.service";

class MessageService extends BaseService<IMessage> {
    constructor() {
        super(messageModel);
    }
}

export default MessageService;
