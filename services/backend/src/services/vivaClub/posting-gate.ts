import { Response } from "express";
import { StatusCodes } from "http-status-codes";

import UserModel from "../../models/user.model";
import sendResponse from "../../utils/commonFunctions/sendResponse";

/**
 * The community-guidelines document the app currently ships.
 *
 * Bump this when the published guidelines change and every user is asked to accept
 * again — the same versioned-consent mechanism already used for the privacy policy and
 * terms, rather than a second one invented for this.
 */
export const CURRENT_COMMUNITY_GUIDELINES_VERSION = "1.0.0";

export const COMMUNITY_GUIDELINES_CONSENT = "community_guidelines";

/** Codes the app switches on, so it can route instead of showing a generic error. */
export enum EPostingDenial {
    GUIDELINES_NOT_ACCEPTED = "GUIDELINES_NOT_ACCEPTED",
    COMMUNITY_BANNED = "COMMUNITY_BANNED",
    MEDIA_NOT_SUPPORTED = "MEDIA_NOT_SUPPORTED",
}

/**
 * 403 — the correct code for "we know who you are, and no".
 *
 * This briefly answered 409 to dodge an app bug: the response interceptor treated
 * *every* 403 as an expired token, so refusing an authenticated user signed them out
 * mid-comment and took the client's own recovery path with it — the session was
 * cleared before the screen's catch block could open the guidelines sheet.
 *
 * That is fixed properly now. The client distinguishes the two by the `code` on the
 * body (see EAuthDenial), so a denial here **must** carry one, or it is read as an
 * expired session and logs the user out. That is the contract, and it is why every
 * branch below sets one.
 */
const POSTING_DENIAL_STATUS = StatusCodes.FORBIDDEN;

export const hasAcceptedGuidelines = (user: {
    consents?: { type: string; version: string }[] | null;
}): boolean =>
    (user.consents ?? []).some(
        (c) =>
            c.type === COMMUNITY_GUIDELINES_CONSENT &&
            c.version === CURRENT_COMMUNITY_GUIDELINES_VERSION,
    );

/**
 * Gate shared by post creation and commenting.
 *
 * Returns a truthy value when it has already answered the request, so the caller must
 * stop — the same contract as `assertWithinPostLimit` in vivaClub.service.ts, so both
 * guards read the same way at the call site.
 *
 * The UGC policy requires users to accept terms *before* creating content, which is why
 * this runs ahead of any write rather than being a signup-only checkbox: users who
 * registered before the guidelines existed have to accept them too.
 */
export async function assertMayPost(
    userId: unknown,
    res: Response,
    mediaUrls?: unknown,
): Promise<boolean> {
    // No client can produce media: there is no picker, no upload and no FormData
    // anywhere in the app. Accepting arbitrary URLs would be an unmoderated image
    // surface with nothing behind it, so the field is refused rather than policed.
    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
        sendResponse({
            response: res,
            statusCode: StatusCodes.BAD_REQUEST,
            success: false,
            message: "Attachments are not supported",
            data: { code: EPostingDenial.MEDIA_NOT_SUPPORTED },
        });
        return true;
    }

    if (!userId) return false;

    const user = await UserModel.findById(userId).select("consents communityBanned").lean();
    if (!user) return false;

    if (user.communityBanned) {
        sendResponse({
            response: res,
            statusCode: POSTING_DENIAL_STATUS,
            success: false,
            message: "Your access to Viva Club has been suspended",
            data: { code: EPostingDenial.COMMUNITY_BANNED },
        });
        return true;
    }

    if (!hasAcceptedGuidelines(user)) {
        sendResponse({
            response: res,
            statusCode: POSTING_DENIAL_STATUS,
            success: false,
            message: "Please accept the community guidelines before posting",
            data: {
                code: EPostingDenial.GUIDELINES_NOT_ACCEPTED,
                version: CURRENT_COMMUNITY_GUIDELINES_VERSION,
            },
        });
        return true;
    }

    return false;
}
