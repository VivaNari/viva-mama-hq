import { Request, Response } from "express";
import { WeeklyCheckinSSEParams, WeeklyCheckinAnswerParams } from "../../../../types/chat.types";
import logger from "../../../../utils/logger";
import { WEEKLY_CHECKIN_SLUG } from "../../../../constants/chat";
import WeeklyCheckinService from "../../../../services/weeklyCheckin/weeklyCheckin.service";

class WeeklyCheckinController {
    private weeklyCheckinService: WeeklyCheckinService;
    constructor() {
        this.weeklyCheckinService = new WeeklyCheckinService();
    }

    async handleSSEConnection(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?._id?.toString();

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const week = parseInt(req.query.week as string, 10);
            const flowSlug = (req.query.flowSlug as string) || WEEKLY_CHECKIN_SLUG;

            // Validate week
            if (isNaN(week) || week < 1 || week > 52) {
                res.status(400).json({
                    error: "Invalid week parameter. Must be between 1 and 52.",
                });
                return;
            }

            logger.info({ userId, week, flowSlug }, "Weekly check-in SSE request received");

            const params: WeeklyCheckinSSEParams = {
                userId,
                week,
                flowSlug,
            };

            await this.weeklyCheckinService.handleSSEConnection(params, res);
        } catch (error) {
            logger.error({ error }, "Error in weekly check-in SSE controller");

            if (!res.headersSent) {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    }

    /**
     * Process user's answer to a check-in question
     *
     * POST /api/chat/checkin/answer
     *
     * Body:
     * - flowInstanceId: string (required)
     * - nodeId: string (required)
     * - week: number (required)
     * - selectedKeys: number[] (required for single/multi choice)
     * - freeText: string (required for free text questions)
     * - idempotencyKey: string (optional, for retry safety)
     */
    async processAnswer(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?._id?.toString();

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const { flowInstanceId, nodeId, week, selectedKeys, freeText, idempotencyKey } =
                req.body;

            // Validate required fields
            if (!flowInstanceId || !nodeId || week === undefined) {
                res.status(400).json({
                    error: "Missing required fields: flowInstanceId, nodeId, and week are required",
                });
                return;
            }

            // Validate week
            const weekNum = parseInt(week, 10);
            if (isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
                res.status(400).json({ error: "Invalid week parameter" });
                return;
            }

            // Validate answer
            if (!selectedKeys?.length && !freeText) {
                res.status(400).json({
                    error: "Either selectedKeys or freeText must be provided",
                });
                return;
            }

            logger.info(
                { userId, flowInstanceId, nodeId, week: weekNum, idempotencyKey },
                "Processing check-in answer",
            );

            const params: WeeklyCheckinAnswerParams = {
                userId,
                flowInstanceId,
                nodeId,
                week: weekNum,
                selectedKeys,
                freeText,
                idempotencyKey,
            };

            const result = await this.weeklyCheckinService.processAnswer(params);

            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error) {
            logger.error({ error }, "Error processing check-in answer");
            res.status(500).json({ error: "Internal server error" });
        }
    }

    /**
     * Check if a check-in exists for a specific week
     *
     * GET /api/chat/checkin/status?week=5
     */
    async getCheckinStatus(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?._id?.toString();

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const week = parseInt(req.query.week as string, 10);

            if (isNaN(week) || week < 1 || week > 52) {
                res.status(400).json({ error: "Invalid week parameter" });
                return;
            }

            const exists = await this.weeklyCheckinService.hasCheckinForWeek(userId, week);

            res.status(200).json({
                week,
                hasCheckin: exists,
            });
        } catch (error) {
            logger.error({ error }, "Error getting check-in status");
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

export default WeeklyCheckinController;
