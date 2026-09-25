import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import AdminAuthService from "../../../../services/admin/admin-auth.service";
import { OutsideSlotConfirmationRequiredError } from "../../../../services/consultations/consultation.errors";
import { ConsultationService } from "../../../../services/consultations/consultation.service";
import {
    ModerationError,
    moderationService,
} from "../../../../services/vivaClub/moderation.service";
import {
    CallbackRequestStatusEnum,
    ConsultationTypeEnum,
} from "../../../../types/consultation.types";
import { EReportStatus, EReportTargetType } from "../../../../types/moderation.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * The shared errorHandler answers everything with a 500, which would make a missing
 * consultation indistinguishable from an outage. These are the service failures that are
 * really the caller's fault, mapped to the status that says so.
 */
const clientErrorStatus = (err: unknown): number | null => {
    if (!(err instanceof Error)) return null;

    if (err.message === messages.CONSULTATION_NOT_FOUND) {
        return StatusCodes.NOT_FOUND;
    }
    if (err.message === messages.CONSULTATION_ID_NOT_PROVIDED) {
        return StatusCodes.BAD_REQUEST;
    }

    return null;
};

export class AdminController {
    private adminAuthService: AdminAuthService;
    private consultationService: ConsultationService;

    constructor() {
        this.adminAuthService = new AdminAuthService();
        this.consultationService = new ConsultationService();
    }

    login = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { email, password } = request.body;

            const result = await this.adminAuthService.login(email, password);

            return sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.ADMIN_LOGIN_SUCCESS,
                response,
            });
        } catch (err) {
            // A bad credential is a client error, not a server fault — the shared
            // errorHandler would turn it into a 500 and the panel could not tell it
            // apart from an outage.
            if (err instanceof Error && err.message === messages.INVALID_CREDENTIALS) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.UNAUTHORIZED,
                    success: false,
                    message: messages.INVALID_CREDENTIALS,
                    response,
                });
            }
            return next(err);
        }
    };

    /** Lets the panel re-hydrate a session on reload and revalidate a stored token. */
    getProfile = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const admin = await this.adminAuthService.getProfile(request.user._id);

            return sendResponse({
                data: admin,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.ADMIN_PROFILE_FETCHED,
                response,
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * The moderation queue. Unknown enum values are dropped rather than rejected, the
     * same way the consultation listing treats a stale bookmark.
     */
    listReports = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { page, limit, status, targetType } = request.query;

            const parsedStatus = Object.values(EReportStatus).includes(status as EReportStatus)
                ? (status as EReportStatus)
                : undefined;
            const parsedTarget = Object.values(EReportTargetType).includes(
                targetType as EReportTargetType,
            )
                ? (targetType as EReportTargetType)
                : undefined;

            const result = await moderationService.listReports({
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                ...(parsedStatus ? { status: parsedStatus } : {}),
                ...(parsedTarget ? { targetType: parsedTarget } : {}),
            });

            return sendResponse({
                data: result,
                totalCount: result.pagination.total,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Reports fetched successfully",
                response,
            });
        } catch (err) {
            return next(err);
        }
    };

    /** Remove the content, dismiss the report, or ban the author. */
    actionReport = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const report = await moderationService.actionReport({
                reportId: String(request.params.id),
                action: request.body.action,
                reviewerId: request.user?._id,
                note: request.body.note,
            });

            return sendResponse({
                data: report,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Report actioned",
                response,
            });
        } catch (err) {
            if (err instanceof ModerationError) {
                return sendResponse({
                    data: null,
                    statusCode:
                        err.code === "NOT_FOUND"
                            ? StatusCodes.NOT_FOUND
                            : StatusCodes.BAD_REQUEST,
                    success: false,
                    message: err.message,
                    response,
                });
            }
            return next(err);
        }
    };

    listConsultations = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { page, limit, status, consultationType, search } = request.query;

            // Unknown enum values are dropped rather than rejected: a stale bookmark
            // should show an unfiltered list, not an error.
            const parsedStatus = Object.values(CallbackRequestStatusEnum).includes(
                status as CallbackRequestStatusEnum,
            )
                ? (status as CallbackRequestStatusEnum)
                : undefined;

            const parsedType = Object.values(ConsultationTypeEnum).includes(
                consultationType as ConsultationTypeEnum,
            )
                ? (consultationType as ConsultationTypeEnum)
                : undefined;

            const result = await this.consultationService.listForAdmin({
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                ...(parsedStatus ? { status: parsedStatus } : {}),
                ...(parsedType ? { consultationType: parsedType } : {}),
                ...(typeof search === "string" ? { search } : {}),
            });

            return sendResponse({
                data: result,
                totalCount: result.total,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATIONS_FETCHED_SUCCESS,
                response,
            });
        } catch (err) {
            return next(err);
        }
    };

    /**
     * Records the exact 30-minute start the coordinator agreed with the consultant,
     * which is what unlocks the patient's Join button five minutes ahead of the call.
     *
     * Any time is allowed. One outside the window the patient picked comes back as a 409
     * carrying `requires_confirmation`, and the panel re-sends with
     * `acknowledgeOutsideSlot: true` once the coordinator has confirmed it is deliberate.
     */
    confirmMeetingTime = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const id = request.params.id as string;
            const { confirmedAt, acknowledgeOutsideSlot } = request.body;

            if (!id) {
                throw new Error(messages.CONSULTATION_ID_NOT_PROVIDED);
            }

            const result = await this.consultationService.confirmMeetingTime(
                id,
                new Date(confirmedAt),
                Boolean(acknowledgeOutsideSlot),
            );

            return sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_TIME_CONFIRMED_SUCCESS,
                response,
            });
        } catch (err) {
            // Not a validation failure — the write is held, not refused, so the payload
            // has to tell the panel what to re-send rather than just what went wrong.
            if (err instanceof OutsideSlotConfirmationRequiredError) {
                return sendResponse({
                    data: {
                        requires_confirmation: true,
                        preferred_slot_label: err.preferredSlotLabel,
                    },
                    statusCode: StatusCodes.CONFLICT,
                    success: false,
                    message: err.message,
                    response,
                });
            }

            const status = clientErrorStatus(err);
            if (status) {
                return sendResponse({
                    data: null,
                    statusCode: status,
                    success: false,
                    message: (err as Error).message,
                    response,
                });
            }
            return next(err);
        }
    };

    completeConsultation = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const id = request.params.id as string;

            if (!id) {
                throw new Error(messages.CONSULTATION_ID_NOT_PROVIDED);
            }

            const result = await this.consultationService.completeConsultation(id);

            return sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_COMPLETED_SUCCESS,
                response,
            });
        } catch (err) {
            const status = clientErrorStatus(err);
            if (status) {
                return sendResponse({
                    data: null,
                    statusCode: status,
                    success: false,
                    message: (err as Error).message,
                    response,
                });
            }
            return next(err);
        }
    };

    /** Marks the booking UNHANDLED and refunds the credit if one was spent. */
    markUnhandled = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const id = request.params.id as string;

            if (!id) {
                throw new Error(messages.CONSULTATION_ID_NOT_PROVIDED);
            }

            const result = await this.consultationService.markUnhandled(id);

            return sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONSULTATION_UNHANDLED_SUCCESS,
                response,
            });
        } catch (err) {
            const status = clientErrorStatus(err);
            if (status) {
                return sendResponse({
                    data: null,
                    statusCode: status,
                    success: false,
                    message: (err as Error).message,
                    response,
                });
            }
            return next(err);
        }
    };
}

export default AdminController;
