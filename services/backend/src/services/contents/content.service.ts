import contentModel from "../../models/content.model";
import { IContent } from "../../types/content.types";
import BaseService from "../base.service";

export class ContentService extends BaseService<IContent> {
    constructor() {
        super(contentModel);
    }
}
