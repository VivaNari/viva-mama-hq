import aiMessageBookmarkModel from "../../models/ai-message-bookmark.model";
import { IBookmark } from "../../types/ai-message-bookmark.types";
import BaseService from "../base.service";

class AIBookmarkService extends BaseService<IBookmark> {
    constructor() {
        super(aiMessageBookmarkModel);
    }
}

export default AIBookmarkService;
