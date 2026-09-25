import { Router } from "express";
import WeeklyCheckinController from "../controllers/weekly-checkin-v1/weekly-checkin.controller";
import authMiddleware from "../../../middlewares/authorization.middleware";

const router = Router();
const weeklyCheckinController = new WeeklyCheckinController();

/**
 * Weekly Check-in Routes (Request-Response API)
 *
 * All routes require authentication
 */

/**
 * POST /api/v1/chat/checkin/start
 *
 * Start a weekly check-in session
 *
 * Body:
 *   - week: number (required) - The postpartum week number (1-52)
 *   - flowSlug: string (optional) - Flow slug, defaults to "weekly-checkin-v1"
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data:
 *     - flowInstanceId: string
 *     - week: number
 *     - isCompleted: boolean
 *     - nextQuestion: QuestionPayload | null
 *     - progress: { answered: number, total: number }
 */
// NOT gated at the route level. This endpoint serves the onboarding questionnaire
// (`onboarding-flow-v2`) as well as the weekly check-in (`weekly-checkin-v1`) — the app
// starts both through it. A route-level guard locked new users out of onboarding, which
// they have to complete before they could ever choose a tier.
//
// The entitlement check lives in the controller, where the flow slug is known.
router
    .route("/chat/checkin/start")
    .post(authMiddleware("header"), weeklyCheckinController.startCheckin);

/**
 * POST /api/v1/chat/checkin/answer
 *
 * Submit an answer to a check-in question
 *
 * Body:
 *   - flowInstanceId: string (required)
 *   - nodeId: string (required) - Current question node ID
 *   - week: number (required)
 *   - selectedKeys: number[] (required for choice questions)
 *   - freeText: string (required for free text questions)
 *   - idempotencyKey: string (optional) - For retry safety
 *
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data:
 *     - flowInstanceId: string
 *     - week: number
 *     - isCompleted: boolean
 *     - nextQuestion: QuestionPayload | null
 *     - progress: { answered: number, total: number }
 */
router
    .route("/chat/checkin/answer")
    .post(authMiddleware("header"), weeklyCheckinController.processAnswer);

/**
 * GET /api/v1/chat/checkin/current
 *
 * Get current check-in state (for resuming interrupted sessions)
 *
 * Query:
 *   - week: number (required)
 *
 * Response:
 *   - hasActiveCheckin: boolean
 *   - flowInstanceId: string | null
 *   - week: number
 *   - state: string | null
 *   - currentQuestion: QuestionPayload | null
 *   - progress: { answered: number, total: number } | null
 */
router.get(
    "/chat/checkin/answer/current",
    authMiddleware("header"),
    weeklyCheckinController.getCurrentState,
);

/**
 * GET /api/v1/chat/checkin/status
 *
 * Check if a check-in exists for a specific week
 *
 * Query:
 *   - week: number (required)
 *
 * Response:
 *   - week: number
 *   - hasCheckin: boolean
 *   - state: string | null
 *   - isCompleted: boolean
 *   - isExpired: boolean
 *   - progress: { answered: number, total: number } | null
 */
router.get("/status", authMiddleware(), weeklyCheckinController.getCheckinStatus);

export default router;
