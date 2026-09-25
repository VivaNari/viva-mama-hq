import { NextFunction, Request, Response } from "express";
import { ContentService } from "../../../../services/contents/content.service";
import { IContent } from "../../../../types/content.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IUser } from "../../../../types";
import { localizeContent, localizeContents } from "../../../../utils/i18n/localizeContent";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import {
    applyContentEntitlements,
    redactContent,
} from "../../../../services/contents/content-access.service";

export class ContentController {
    private contentService: ContentService;
    constructor() {
        this.contentService = new ContentService();
    }

    /** The articles visible to this user, in the order the free slice is taken. */
    private contentFilter(user: IUser) {
        return {
            // `category` is an array now; an equality match on a scalar still works —
            // Mongo matches any document whose array contains the value.
            category: user.user_category,
            validWeekStart: { $lte: user.current_weekdays.weeks },
            validWeekEnd: { $gte: user.current_weekdays.weeks },
        };
    }

    public getContents = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = (await UserModel.findById(request.user._id)) as IUser;
        try {
            const contents: IContent[] = await this.contentService.find({
                filter: this.contentFilter(user),
                // contentGroup first: 'GLOBAL_HEALTH' (G) sorts before 'WEEKLY_RECOVERY' (W)
                // alphabetically, so videos always appear at the top. sortOrder governs
                // ordering within each group. _id is the tiebreaker for determinism.
                // Note: Mongo sorts nulls first (top of list). We fix this in JS below.
                sort: { contentGroup: 1, sortOrder: 1, _id: 1 },
            });

            // Move unclassified (null contentGroup) items to the end of the list.
            // Node's Array.prototype.sort is stable, so relative order is maintained.
            contents.sort((a, b) => {
                if (!a.contentGroup && b.contentGroup) return 1;
                if (a.contentGroup && !b.contentGroup) return -1;
                return 0;
            });

            const lang = resolveLanguage(request.query?.lang as string, user.preferred_language);
            const tier = entitlementService.resolveTier(user);

            // Localize BEFORE redacting. localizeContent replaces contentBody from the
            // translation bundle, so redacting first would let a translated body be
            // written straight back onto a locked article.
            const localized = localizeContents(contents, lang);
            const gated = applyContentEntitlements(localized, tier);

            sendResponse({
                data: gated,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONTENT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    createContent = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const instance: IContent = await this.contentService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.CONTENT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Re-checks entitlement rather than trusting that the client only asks for articles
     * the list already unlocked — the id is guessable, and this handler previously
     * performed no tier check at all.
     *
     * "Unlocked" is decided by replaying the same slice the list uses, so the two can
     * never disagree about which article is the free one.
     */
    getContentById = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const [content] = await this.contentService.find({
                filter: { _id: request.params.id },
                populate: ["authors", "reviewers"],
            });

            if (!content) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CONTENT_FETCH_FAILED,
                    response,
                });
            }

            const user = request.user
                ? ((await UserModel.findById(request.user._id)) as IUser)
                : null;
            const lang = resolveLanguage(request.query?.lang as string, user?.preferred_language);
            const localized = localizeContent(content, lang);

            if (!user) {
                return sendResponse({
                    data: redactContent(localized),
                    statusCode: StatusCodes.OK,
                    success: true,
                    message: messages.CONTENT_FETCH_SUCCESS,
                    response,
                });
            }

            const tier = entitlementService.resolveTier(user);
            const visible = await this.contentService.find({
                filter: this.contentFilter(user),
                sort: { contentGroup: 1, sortOrder: 1, _id: 1 },
            });
            visible.sort((a, b) => {
                if (!a.contentGroup && b.contentGroup) return 1;
                if (a.contentGroup && !b.contentGroup) return -1;
                return 0;
            });
            const gated = applyContentEntitlements(localizeContents(visible, lang), tier);
            const match = gated.find((item) => String(item._id) === String(content._id));

            sendResponse({
                // Not in her visible set at all, or in it but past the slice → locked.
                data: !match || match.isLocked ? redactContent(localized) : localized,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONTENT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
