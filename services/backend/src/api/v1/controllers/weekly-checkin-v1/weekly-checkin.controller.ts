import { Request, Response } from "express";
import {
    WeeklyCheckinStartParams,
    WeeklyCheckinAnswerParams,
} from "../../../../types/weekly-checkin-v1.types";
import logger from "../../../../utils/logger";
import { WEEKLY_CHECKIN_SLUG } from "../../../../constants/chat";
import WeeklyCheckinService from "../../../../services/weekly-checkin-v1/weekly-checkin.service";
import flowInstanceModel from "../../../../models/flowInstance.model";
import { FlowInstanceStateEnum } from "../../../../types/chat.types";
import { ECapability } from "../../../../services/entitlements/entitlement.config";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import { isEntitlementDenied, sendDenial } from "../../../../middlewares/entitlement.middleware";

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

            // Gate the weekly check-in ONLY.
            //
            // This endpoint also starts the onboarding questionnaire, which every user
            // must complete before they can even choose a tier — gating it would lock
            // new users out of the app entirely. The flow slug is the only thing that
            // distinguishes the two, and it is not known until here, which is why the
            // check cannot live on the route.
            if (flowSlug === WEEKLY_CHECKIN_SLUG) {
                try {
                    // Denies FREE on every call, resume or not.
                    await entitlementService.assertCapability(userId, ECapability.CHECKIN_WEEKLY);

                    // Meter only a genuinely NEW check-in. startCheckin is
                    // resume-or-create, so counting every call would mean a trial user
                    // whose app was interrupted burns her single allowance simply by
                    // reopening the check-in she never finished.
                    //
                    // "A row exists" is NOT the test for that: the week job pre-creates
                    // every check-in in PENDING, so the old `exists({userId, week})` probe
                    // matched before she had touched anything and the trial's single-use
                    // quota was never spent at all. It also lacked a flowSlug filter, so
                    // an onboarding instance for the same week collided with it.
                    //
                    // ACTIVE is the real resume signal — validateSSERequest flips
                    // PENDING -> ACTIVE the first time she opens the flow.
                    const existing = await flowInstanceModel
                        .findOne({
                            userId,
                            flowSlug: WEEKLY_CHECKIN_SLUG,
                            postpartumWeek: week,
                        })
                        .select("state")
                        .lean();

                    const isResume = existing?.state === FlowInstanceStateEnum.ACTIVE;

                    if (!isResume) {
                        await entitlementService.consumeCapability(
                            userId,
                            ECapability.CHECKIN_WEEKLY,
                        );
                    }
                } catch (error) {
                    if (isEntitlementDenied(error)) {
                        sendDenial(error, res, userId);
                        return;
                    }
                    throw error;
                }
            }

            const params: WeeklyCheckinStartParams = {
                userId,
                week,
                flowSlug,
                lang: (req.body?.lang as string) || (req.query?.lang as string),
            };

            const result = await this.weeklyCheckinService.startCheckin(params);
            if (result.success) {
                res.status(200).json(result);
            } else {
                const statusCode = result.errorType === "ALREADY_COMPLETED" ? 409 : 400;
                res.status(statusCode).json(result);
            }
        } catch (error) {
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
     * - selectedValues: string[] (option `value` tokens — preferred identity for
     *   single/multi choice; unique per node)
     * - selectedKeys: number[] (legacy option scores; ambiguous when options share
     *   a score — kept only for app builds predating selectedValues)
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

            const {
                flowInstanceId,
                nodeId,
                week,
                selectedKeys,
                selectedValues,
                freeText,
                idempotencyKey,
            } = req.body;

            if (selectedValues !== undefined && !Array.isArray(selectedValues)) {
                res.status(400).json({ error: "selectedValues must be an array" });
                return;
            }

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
            if (!selectedValues?.length && !selectedKeys?.length && !freeText) {
                res.status(400).json({
                    error: "Either selectedValues, selectedKeys or freeText must be provided",
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
                selectedValues,
                freeText,
                idempotencyKey,
                lang: (req.body?.lang as string) || (req.query?.lang as string),
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

            const lang = (req.query?.lang as string) || undefined;
            const result = await this.weeklyCheckinService.getCurrentState(userId, week, lang);

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
