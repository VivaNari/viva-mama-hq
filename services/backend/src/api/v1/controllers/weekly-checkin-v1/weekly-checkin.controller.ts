import { Request, Response } from "express";
import {
    WeeklyCheckinStartParams,
    WeeklyCheckinAnswerParams,
} from "../../../../types/weekly-checkin-v1.types";
import logger from "../../../../utils/logger";
import { WEEKLY_CHECKIN_SLUG } from "../../../../constants/chat";
import WeeklyCheckinService from "../../../../services/weekly-checkin-v1/weekly-checkin.service";

class WeeklyCheckinController {
    private weeklyCheckinService: WeeklyCheckinService;

    constructor() {
        this.weeklyCheckinService = new WeeklyCheckinService();
    }

    /**
     * Start a weekly check-in session
     *
     * POST /api/chat/checkin/start
     *
     * Body:
     * - week: number (required)
     * - flowSlug: string (optional, defaults to weekly-checkin-v1)
     *
     * Returns:
     * - flowInstanceId: string
     * - week: number
     * - question: object (first question)
     * - totalQuestions: number (estimated)
     */
    startCheckin = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log("sadasdads");
            const userId = req.user?._id?.toString();

            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const week = parseInt(req.body.week, 10);
            const flowSlug = (req.body.flowSlug as string) || WEEKLY_CHECKIN_SLUG;

            // Validate week
            if (isNaN(week) || week < 1 || week > 52) {
                res.status(400).json({
                    error: "Invalid week parameter. Must be between 1 and 52.",
                });
                return;
            }

            logger.info({ userId, week, flowSlug }, "Weekly check-in start request");

            const params: WeeklyCheckinStartParams = {
                userId,
                week,
                flowSlug,
            };

            const result = await this.weeklyCheckinService.startCheckin(params);
            console.log("v1", result);
            if (result.success) {
                res.status(200).json(result);
            } else {
                const statusCode = result.errorType === "ALREADY_COMPLETED" ? 409 : 400;
                res.status(statusCode).json(result);
            }
        } catch (error) {
            console.log("error", error);
            logger.error({ error }, "Error starting weekly check-in");
            res.status(500).json({ error: "Internal server error" });
        }
    };

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
     *
     * Returns:
     * - success: boolean
     * - message: string
     * - data:
     *   - flowInstanceId: string
     *   - week: number
     *   - nextQuestion: object | null (null if completed)
     *   - isCompleted: boolean
     *   - progress: { answered: number, total: number }
     */
    processAnswer = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.user?._id?.toString();
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const { flowInstanceId, nodeId, week, selectedKeys, freeText, idempotencyKey } =
                req.body;
            console.log("nodeId inside controller", nodeId);

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
    };

    /**
     * Get current check-in state (for resuming interrupted sessions)
     *
     * GET /api/chat/checkin/current?week=5
     *
     * Returns current question if check-in is in progress
     */
    getCurrentState = async (req: Request, res: Response): Promise<void> => {
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

            const result = await this.weeklyCheckinService.getCurrentState(userId, week);

            res.status(200).json(result);
        } catch (error) {
            logger.error({ error }, "Error getting check-in state");
            res.status(500).json({ error: "Internal server error" });
        }
    };

    /**
     * Check if a check-in exists for a specific week
     *
     * GET /api/chat/checkin/status?week=5
     */
    getCheckinStatus = async (req: Request, res: Response): Promise<void> => {
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

            const status = await this.weeklyCheckinService.getCheckinStatus(userId, week);

            res.status(200).json(status);
        } catch (error) {
            logger.error({ error }, "Error getting check-in status");
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

export default WeeklyCheckinController;
