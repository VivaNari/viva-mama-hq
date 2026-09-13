import { Request, Response } from "express";

import ChildService, { ChildNotFoundError } from "../../../../services/childs/child.service";
import logger, { createModuleLogger } from "../../../../utils/logger";

const log = createModuleLogger(logger, "child.controller");
const childService = new ChildService();

/** A missing child is a 404, anything else is ours. */
const handleError = (error: unknown, res: Response, context: Record<string, unknown>) => {
    if (error instanceof ChildNotFoundError) {
        res.status(404).json({ success: false, message: error.message });
        return;
    }

    log.error({ error, ...context }, "Child request failed");
    res.status(500).json({ success: false, message: "Something went wrong." });
};

export default class ChildController {
    addChild = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        try {
            const child = await childService.addChild({
                userId,
                name: req.body.name,
                date_of_birth: req.body.date_of_birth,
                sex: req.body.sex,
            });

            res.status(201).json({ success: true, message: "Child added successfully!", child });
        } catch (error) {
            handleError(error, res, { userId });
        }
    };

    listChildren = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        try {
            const children = await childService.listChildren(userId);
            res.status(200).json({ success: true, children });
        } catch (error) {
            handleError(error, res, { userId });
        }
    };

    updateChild = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const childId = req.params.childId as string;

        try {
            const child = await childService.updateChild({
                userId,
                childId,
                ...(req.body.name !== undefined ? { name: req.body.name } : {}),
                ...(req.body.date_of_birth !== undefined
                    ? { date_of_birth: req.body.date_of_birth }
                    : {}),
                ...(req.body.sex !== undefined ? { sex: req.body.sex } : {}),
                ...(req.body.birth_measurements !== undefined
                    ? { birth_measurements: req.body.birth_measurements }
                    : {}),
            });

            res.status(200).json({ success: true, message: "Child updated.", child });
        } catch (error) {
            handleError(error, res, { userId, childId });
        }
    };

    deleteChild = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const childId = req.params.childId as string;

        try {
            await childService.deleteChild(userId, childId);
            res.status(200).json({ success: true, message: "Child deleted." });
        } catch (error) {
            handleError(error, res, { userId, childId });
        }
    };
}
