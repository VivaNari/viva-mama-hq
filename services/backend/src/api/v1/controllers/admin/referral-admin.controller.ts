import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "mongoose";

import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { referralAdminService } from "../../../../services/referral/referral-admin.service";
import { ReferralError, referralService } from "../../../../services/referral/referral.service";
import { EReferralOwnerType, EReferralRedemptionStatus } from "../../../../types/referral.types";

/**
 * Admin surface for referral programs.
 *
 * `requestValidator` only ever sees `req.body`, so path params and query strings are
 * checked here — an invalid `:id` would otherwise reach mongoose and surface as a 500.
 */
export class ReferralAdminController {
    private requireId(request: Request): string {
        const id = request.params.id as string;
        if (!id || !isValidObjectId(id)) {
            throw new ReferralError("INVALID_ID", "That id is not valid", 400);
        }
        return id;
    }

    private fail(err: unknown, response: Response, next: NextFunction) {
        if (err instanceof ReferralError) {
            return sendResponse({
                data: { code: err.code },
                statusCode: err.statusCode,
                success: false,
                message: err.message,
                response,
            });
        }
        return next(err);
    }

    private paging(request: Request) {
        return {
            page: Math.max(1, Number(request.query.page) || 1),
            limit: Math.min(100, Math.max(1, Number(request.query.limit) || 20)),
        };
    }

    private boolParam(value: unknown): boolean | undefined {
        if (value === "true") return true;
        if (value === "false") return false;
        return undefined;
    }

    // ── Organizations ───────────────────────────────────────────────────────────

    public createOrganization = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const org = await referralAdminService.createOrganization(req.body);
            return sendResponse({
                data: org,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: "Organization created",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public listOrganizations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await referralAdminService.listOrganizations({
                ...this.paging(req),
                isActive: this.boolParam(req.query.isActive),
                q: (req.query.q as string) || undefined,
            });
            return sendResponse({
                data: result,
                totalCount: result.total,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Organizations fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public getOrganization = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const org = await referralAdminService.getOrganization(this.requireId(req));
            return sendResponse({
                data: org,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Organization fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const org = await referralAdminService.updateOrganization(
                this.requireId(req),
                req.body,
            );
            return sendResponse({
                data: org,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Organization updated",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    // ── Programs ────────────────────────────────────────────────────────────────

    public createProgram = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const program = await referralAdminService.createProgram(req.body);
            return sendResponse({
                data: program,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: "Referral program created",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public listPrograms = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ownerType = Object.values(EReferralOwnerType).includes(
                req.query.ownerType as EReferralOwnerType,
            )
                ? (req.query.ownerType as EReferralOwnerType)
                : undefined;

            const result = await referralAdminService.listPrograms({
                ...this.paging(req),
                ownerType,
                isActive: this.boolParam(req.query.isActive),
                q: (req.query.q as string) || undefined,
            });

            return sendResponse({
                data: result,
                totalCount: result.total,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Referral programs fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public getProgram = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const program = await referralAdminService.getProgram(this.requireId(req));
            return sendResponse({
                data: program,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Referral program fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public updateProgram = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const program = await referralAdminService.updateProgram(this.requireId(req), req.body);
            return sendResponse({
                data: program,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Referral program updated",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public addSeats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const program = await referralAdminService.addSeats(
                this.requireId(req),
                Number(req.body.addSeats),
            );
            return sendResponse({
                data: program,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Seats added",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    public programUsage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const usage = await referralAdminService.programUsage(this.requireId(req));
            return sendResponse({
                data: usage,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Referral program usage fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    // ── Redemptions ─────────────────────────────────────────────────────────────

    public listRedemptions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const status = Object.values(EReferralRedemptionStatus).includes(
                req.query.status as EReferralRedemptionStatus,
            )
                ? (req.query.status as EReferralRedemptionStatus)
                : undefined;

            const result = await referralAdminService.listRedemptions({
                ...this.paging(req),
                programId: (req.query.programId as string) || undefined,
                code: (req.query.code as string) || undefined,
                status,
                from: req.query.from ? new Date(req.query.from as string) : undefined,
                to: req.query.to ? new Date(req.query.to as string) : undefined,
            });

            return sendResponse({
                data: result,
                totalCount: result.total,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Redemptions fetched",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    /** The operational answer to a FAILED row. */
    public retryGrant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const redemption = await referralService.retryGrant(this.requireId(req));
            return sendResponse({
                data: redemption,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Grant retried",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };

    /**
     * Undo a redemption so the user can redeem again — the support answer for someone
     * who entered the wrong code. Frees the seat; deliberately leaves any granted
     * subscription alone.
     */
    public revokeRedemption = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await referralService.revoke(this.requireId(req));
            return sendResponse({
                data: null,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Redemption revoked",
                response: res,
            });
        } catch (err) {
            return this.fail(err, res, next);
        }
    };
}

export default ReferralAdminController;
