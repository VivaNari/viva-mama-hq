import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";

import { messages } from "../../../../constants/messages";
import {
    formatDateToISO,
    getISTCalendarDate,
    parseISODateToStartOfDay,
} from "../../../../services/date/date.service";
import FeedingLogService, {
    ChildNotFoundError,
    TFeedingEntry,
    isOldEnoughForSolids,
    totalsFor,
} from "../../../../services/feeding-log/feeding-log.service";
import {
    IFeedingLog,
    TFeedingEntryKind,
    TFoodReaction,
} from "../../../../types/feeding-log.types";
import { FeedingMethodEnum, IChild } from "../../../../types/user.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Tolerance for a phone clock running fast.
 *
 * Instants rather than whole dates are compared here, as on the diaper log, so a device a
 * minute or two ahead of the server would otherwise have a genuine feed rejected as being
 * in the future. Five minutes absorbs ordinary drift while still refusing a time that is
 * actually wrong.
 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export default class FeedingLogController {
    private feedingLogService: FeedingLogService;

    constructor() {
        this.feedingLogService = new FeedingLogService();
    }

    /** `loggedOn` goes out as "YYYY-MM-DD", the shape the client keys its date strip on. */
    private serialize = (log: IFeedingLog) => ({
        _id: log._id,
        childId: log.childId,
        loggedOn: formatDateToISO(log.loggedOn),
        feedingMethod: log.feedingMethod,
        feeds: log.feeds ?? [],
        solids: log.solids ?? [],
        water: log.water ?? [],
        totals: totalsFor(log),
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
    });

    private badRequest = (res: Response, message: string) =>
        sendResponse({
            data: null,
            statusCode: StatusCodes.BAD_REQUEST,
            success: false,
            message,
            response: res,
        });

    private notFound = (res: Response, message: string) =>
        sendResponse({
            data: null,
            statusCode: StatusCodes.NOT_FOUND,
            success: false,
            message,
            response: res,
        });

    /**
     * Build the subdocument for one entry, with its id generated here.
     *
     * Generated rather than left to Mongo because `$push` gives no pointer to what it just
     * appended, and the client needs that id to be able to remove the row again.
     *
     * The body has already been through the validator, which is what guarantees `side` and
     * `minutes` are present for a direct feed and `ml` for every other. `reactions` is defaulted
     * here rather than relying on the validator's `.default([])` — `requestValidator`
     * discards Joi's coerced value and passes the raw body on.
     */
    private buildEntry = (
        kind: TFeedingEntryKind,
        body: Record<string, any>,
    ): { entry: TFeedingEntry; at: Date } => {
        const _id = new Types.ObjectId();

        if (kind === "water") {
            const drankAt = new Date(body.drankAt);
            return {
                entry: { _id, ml: body.ml, drankAt } as unknown as TFeedingEntry,
                at: drankAt,
            };
        }

        const feedAt = new Date(body.feedAt);

        if (kind === "solid") {
            return {
                entry: {
                    _id,
                    food: String(body.food).trim(),
                    reactions: (body.reactions ?? []) as TFoodReaction[],
                    // Spread only when sent, so a portion nobody measured is absent from
                    // the document rather than stored as an explicit undefined.
                    ...(body.quantity !== undefined
                        ? { quantity: body.quantity, quantityUnit: body.quantityUnit }
                        : {}),
                    ...(body.texture !== undefined ? { texture: body.texture } : {}),
                    feedAt,
                } as unknown as TFeedingEntry,
                at: feedAt,
            };
        }

        return {
            entry: {
                _id,
                milkSource: body.milkSource,
                ...(body.deliveryMethod !== undefined
                    ? { deliveryMethod: body.deliveryMethod }
                    : {}),
                ...(body.deliveryMethod === "direct"
                    ? { side: body.side, minutes: body.minutes }
                    : { ml: body.ml }),
                feedAt,
            } as unknown as TFeedingEntry,
            at: feedAt,
        };
    };

    /**
     * The gate on solids and water, in the one place both the POST and the settings PATCH
     * can reach it.
     *
     * Two conditions, not one. Age is the clinical floor; `solids_started_on` is the
     * mother's own statement that complementary feeding has actually begun, and a solid
     * logged before she has said so would be a record nobody made.
     */
    private solidsRefusal = (child: IChild, at: Date): string | null => {
        if (!isOldEnoughForSolids(child, at)) return messages.FEEDING_LOG_SOLIDS_TOO_EARLY;
        if (!child.solids_started_on) return messages.FEEDING_LOG_SOLIDS_NOT_STARTED;
        return null;
    };

    createFeedingLogEntry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, kind } = req.body as {
                childId: string;
                kind: TFeedingEntryKind;
            };

            const { entry, at } = this.buildEntry(kind, req.body);

            if (Number.isNaN(at.getTime())) {
                return this.badRequest(res, messages.FEEDING_LOG_INVALID_DATE);
            }

            // A feed cannot have happened in the future.
            if (at.getTime() > Date.now() + CLOCK_SKEW_TOLERANCE_MS) {
                return this.badRequest(res, messages.FEEDING_LOG_FUTURE_NOT_ALLOWED);
            }

            // Today's entries are editable until the IST day ends; earlier days are closed.
            //
            // Enforced here rather than only in the app, where it would be decoration: the
            // UI hides the composer on a past day, but without this the endpoint would
            // accept any past instant and the rule would hold only until somebody called
            // the API directly.
            const loggedOn = getISTCalendarDate(at);
            if (loggedOn.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.FEEDING_LOG_DAY_CLOSED);
            }

            const { child, settings } = await this.feedingLogService.resolveSettings(
                req.user._id,
                childId,
            );

            // Nor before the child existed.
            if (child.date_of_birth) {
                const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
                if (loggedOn.getTime() < birthDay.getTime()) {
                    return this.badRequest(res, messages.FEEDING_LOG_BEFORE_BIRTH);
                }
            }

            if (kind !== "feed") {
                const refusal = this.solidsRefusal(child, at);
                if (refusal) return this.badRequest(res, refusal);
            }

            const result = await this.feedingLogService.addEntry({
                userId: req.user._id,
                childId,
                kind,
                entry,
                at,
                feedingMethod: settings.feedingMethod,
            });

            return sendResponse({
                data: {
                    childId,
                    loggedOn: formatDateToISO(result.loggedOn),
                    kind,
                    entry: result.entry,
                    totals: result.totals,
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FEEDING_LOG_SAVED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.FEEDING_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    /**
     * The days, plus the settings the screen opens with.
     *
     * Settings travel with the list rather than being read off route params, which are a
     * snapshot of the app's SQLite copy of the user and can be behind what another device
     * — or Edit Profile — has since written.
     */
    getChildFeedingLogs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const childId = typeof req.query.childId === "string" ? req.query.childId : "";
            if (!childId) {
                return this.badRequest(res, messages.FEEDING_LOG_CHILD_NOT_FOUND);
            }

            // Parsed here rather than by requestValidator, which only inspects req.body.
            const from =
                typeof req.query.from === "string"
                    ? parseISODateToStartOfDay(req.query.from)
                    : null;
            const to =
                typeof req.query.to === "string"
                    ? parseISODateToStartOfDay(req.query.to)
                    : null;

            if ((req.query.from && !from) || (req.query.to && !to)) {
                return this.badRequest(res, messages.FEEDING_LOG_INVALID_DATE);
            }

            const { settings } = await this.feedingLogService.resolveSettings(
                req.user._id,
                childId,
            );

            const logs = await this.feedingLogService.listForChild({
                userId: req.user._id,
                childId,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
            });

            return sendResponse({
                data: { settings, days: logs.map(this.serialize) },
                totalCount: logs.length,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FEEDING_LOG_FETCH_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.FEEDING_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    deleteFeedingLogEntry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, loggedOn, kind, entryId } = req.body;

            const parsedDate = parseISODateToStartOfDay(loggedOn);
            if (!parsedDate) {
                return this.badRequest(res, messages.FEEDING_LOG_INVALID_DATE);
            }

            // Removing from a past day is the same act as adding to it.
            if (parsedDate.getTime() !== getISTCalendarDate().getTime()) {
                return this.badRequest(res, messages.FEEDING_LOG_DAY_CLOSED);
            }

            await this.feedingLogService.getOwnedChild(req.user._id, childId);

            const { removed, totals } = await this.feedingLogService.removeEntry({
                userId: req.user._id,
                childId,
                loggedOn: parsedDate,
                kind,
                entryId,
            });

            if (!removed) {
                return this.notFound(res, messages.FEEDING_LOG_NOT_FOUND);
            }

            return sendResponse({
                data: { childId, loggedOn, kind, entryId, totals },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FEEDING_LOG_DELETED_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.FEEDING_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };

    /**
     * The per-child feeding settings: how the baby is fed, and whether solids have started.
     *
     * Writes the child and nothing else. The mother's own onboarding answer and the
     * `is_breastfeeding_currently` flag derived from it decide which weekly check-in
     * questions she is asked; moving them from a baby's feeding log would change a
     * different product surface without her having asked for it.
     */
    updateFeedingSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { childId, feedingMethod, solidsStartedOn } = req.body as {
                childId: string;
                feedingMethod?: FeedingMethodEnum;
                solidsStartedOn?: string | null;
            };

            const { child } = await this.feedingLogService.resolveSettings(
                req.user._id,
                childId,
            );

            let startedOn: Date | null | undefined;

            if (solidsStartedOn !== undefined) {
                if (solidsStartedOn === null) {
                    // Clearing is always allowed: a mother who taps "started solids" and
                    // then finds the baby refuses them must be able to take it back.
                    startedOn = null;
                } else {
                    const parsed = parseISODateToStartOfDay(solidsStartedOn);
                    if (!parsed) {
                        return this.badRequest(res, messages.FEEDING_LOG_INVALID_DATE);
                    }

                    if (parsed.getTime() > getISTCalendarDate().getTime()) {
                        return this.badRequest(res, messages.FEEDING_LOG_FUTURE_NOT_ALLOWED);
                    }

                    // The age gate applies to the date being claimed, not to today, so a
                    // start date cannot be back-dated to before the baby turned six months.
                    if (!isOldEnoughForSolids(child, parsed)) {
                        return this.badRequest(res, messages.FEEDING_LOG_SOLIDS_TOO_EARLY);
                    }

                    startedOn = parsed;
                }
            }

            await this.feedingLogService.updateSettings({
                userId: req.user._id,
                childId,
                ...(feedingMethod !== undefined ? { feedingMethod } : {}),
                ...(startedOn !== undefined ? { solidsStartedOn: startedOn } : {}),
            });

            const { settings } = await this.feedingLogService.resolveSettings(
                req.user._id,
                childId,
            );

            return sendResponse({
                data: { childId, settings },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FEEDING_LOG_SETTINGS_SUCCESS,
                response: res,
            });
        } catch (error) {
            if (error instanceof ChildNotFoundError) {
                return this.notFound(res, messages.FEEDING_LOG_CHILD_NOT_FOUND);
            }
            return next(error);
        }
    };
}
