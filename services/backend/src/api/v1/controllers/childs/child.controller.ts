import { Request, Response } from "express";
import ChildService from "../../../../services/childs/child.service";

const getChildService = new ChildService();

export default class ChildController {
    addChild = async (req: Request, res: Response) => {
        await getChildService.addChild(req, res);
    };
}
