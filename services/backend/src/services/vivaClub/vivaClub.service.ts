import { Request, Response } from "express";
import VivaClubPostModel from "../../models/vivaClubPost.model";
import VivaClubCommentModel from "../../models/vivaClubComment.model";
import UserModel from "../../models/user.model";
import { sendPushNotification } from "../../utils/sendPushNotification";
import BaseService from "../base.service";
import { IVivaClubPost } from "../../types/vivaClub.types";
import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import { ECapability } from "../entitlements/entitlement.config";
import { entitlementService } from "../entitlements/entitlement.service";
import { EDenialCode } from "../entitlements/entitlement.errors";
import { ESubscriptionTier } from "../../types/subscription.types";
import { invisibleAuthorsFor, visibleContentFilter } from "./moderation.service";
import { assertMayPost } from "./posting-gate";

/**
 * Reject text over the tier's character cap.
 *
 * Returns `true` when the request has been answered, so the caller must stop.
 *
 * The explicit `true` matters: this used to `return sendResponse(...)`, and
 * `sendResponse` has no return statement, so the guard always evaluated falsy. The 402
 * went out and then the handler carried straight on and created the post anyway —
 * two responses on one request, and the character cap enforced nowhere but the
 * TextInput's `maxLength`, which is a suggestion.
 *
 * The denial carries the same 402 shape as every other paywall refusal, including the
 * cap itself — the app renders the counter from this rather than hardcoding a number,
 * so the limit can be tuned without an app release.
 */
async function assertWithinPostLimit(
    userId: unknown,
    content: string,
    res: Response,
): Promise<boolean> {
    if (!userId) return false;

    const { tier, rule } = await entitlementService.resolveFor(
        userId as string,
        ECapability.COMMUNITY_POST,
    );

    const maxChars = rule.maxChars;
    if (maxChars == null || content.length <= maxChars) return false;

    sendResponse({
        response: res,
        statusCode: 402,
        success: false,
        message: `Posts are limited to ${maxChars} characters on your current plan`,
        data: {
            code: EDenialCode.QUOTA_EXCEEDED,
            capability: ECapability.COMMUNITY_POST,
            tier,
            limit: maxChars,
            used: content.length,
            upsell: ESubscriptionTier.PREMIUM,
        },
    });
    return true;
}

/**
 * The author's id as a string, whether `user` is still a raw ObjectId or has already
 * been replaced by a populated document.
 */
const authorId = (doc: { user?: unknown }): string => {
    const user = doc.user as { _id?: unknown } | null | undefined;
    if (!user) return "";
    return String((user as { _id?: unknown })._id ?? user);
};

export default class VivaClubService extends BaseService<IVivaClubPost> {
    constructor() {
        super(VivaClubPostModel);
    }

    /**
     * Fetch paginated posts with author details and comment counts
     */
    getPosts = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            // Hidden/removed content and blocked authors are excluded here rather than
            // in the app, so one rule governs visibility everywhere.
            const hiddenAuthors = await invisibleAuthorsFor(req.user?._id);
            const feedFilter = {
                ...visibleContentFilter(),
                user: { $nin: hiddenAuthors },
            };

            const posts = await VivaClubPostModel.find(feedFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .lean();

            // Enhance posts with comment counts and like status
            const enhancedPosts = await Promise.all(
                posts.map(async (post: any) => {
                    // Must match what getPostDetails will actually list, blocked authors
                    // included — otherwise the card promises "3 comments" and the
                    // detail screen opens showing one.
                    const commentCount = await VivaClubCommentModel.countDocuments({
                        post: post._id,
                        ...visibleContentFilter(),
                        user: { $nin: hiddenAuthors },
                    });
                    const isLiked = post.likes.some(
                        (id: any) => id.toString() === req.user?._id.toString(),
                    );

                    // Flatten user name for frontend
                    if (post.user && post.user.onboarding_data) {
                        post.user.user_name = post.user.onboarding_data.preferred_name;
                        delete post.user.onboarding_data;
                    }

                    return {
                        ...post,
                        commentCount,
                        isLiked,
                        totalLikes: post.likes.length,
                        // Decided here rather than in the app: the client would have to
                        // compare a populated author object against its own stored id,
                        // and the delete endpoint enforces ownership anyway.
                        isOwn: authorId(post) === String(req.user?._id),
                    };
                }),
            );

            // Must use the same filter as the query above. An unfiltered count would
            // overstate totalPages and leave the reader paging into empty screens.
            const totalPosts = await VivaClubPostModel.countDocuments(feedFilter);

            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                message: "Posts fetched successfully",
                success: true,
                data: {
                    posts: enhancedPosts,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(totalPosts / limit),
                        totalPosts,
                    },
                },
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null,
            });
        }
    };

    /**
     * Create a new post
     */
    createPost = async (req: Request, res: Response) => {
        try {
            const { content, mediaUrls } = req.body;
            if (!content) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.BAD_REQUEST,
                    message: "Content is required",
                    success: false,
                    data: null,
                });
            }

            // Guidelines acceptance, community ban and attachments — the UGC policy
            // requires terms be accepted before content is created, so this runs first.
            const blocked = await assertMayPost(req.user?._id, res, mediaUrls);
            if (blocked) return blocked;

            // Enforced server-side: `maxLength` on a TextInput is a suggestion, and this
            // is the difference between the free and paid posting experience.
            const capExceeded = await assertWithinPostLimit(req.user?._id, content, res);
            if (capExceeded) return capExceeded;

            const newPost = await VivaClubPostModel.create({
                user: req.user?._id,
                content,
                mediaUrls: mediaUrls || [],
                likes: [],
            });

            return sendResponse({
                response: res,
                statusCode: StatusCodes.CREATED,
                message: "Post created successfully",
                success: true,
                data: newPost,
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null,
            });
        }
    };

    /**
     * Get single post details with comments
     */
    getPostDetails = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const hiddenAuthors = await invisibleAuthorsFor(req.user?._id);

            // A direct link to a hidden or blocked post must 404 rather than render:
            // otherwise moderation is trivially bypassed by opening the post id.
            const post = await VivaClubPostModel.findOne({
                _id: id,
                ...visibleContentFilter(),
                user: { $nin: hiddenAuthors },
            })
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .lean();

            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null,
                });
            }

            // Same two filters again: a visible post can still carry a hidden comment,
            // or one from someone the reader has blocked.
            const comments = await VivaClubCommentModel.find({
                post: id,
                ...visibleContentFilter(),
                user: { $nin: hiddenAuthors },
            })
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .sort({ createdAt: 1 })
                .lean();

            const isLiked = post.likes.some(
                (id: any) => id.toString() === req.user?._id.toString(),
            );

            // Flatten names for frontend
            if (post.user && (post.user as any).onboarding_data) {
                (post.user as any).user_name = (post.user as any).onboarding_data.preferred_name;
                delete (post.user as any).onboarding_data;
            }

            const enhancedComments = comments.map((comment: any) => {
                if (comment.user && comment.user.onboarding_data) {
                    comment.user.user_name = comment.user.onboarding_data.preferred_name;
                    delete comment.user.onboarding_data;
                }
                comment.isOwn = authorId(comment) === String(req.user?._id);
                return comment;
            });

            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                message: "Post details fetched",
                success: true,
                data: {
                    ...post,
                    comments: enhancedComments,
                    commentCount: enhancedComments.length,
                    isLiked,
                    totalLikes: post.likes.length,
                    isOwn: authorId(post) === String(req.user?._id),
                },
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null,
            });
        }
    };

    /**
     * Add a comment to a post and notify the author
     */
    addComment = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { content } = req.body;

            if (!content) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.BAD_REQUEST,
                    message: "Comment content is required",
                    success: false,
                    data: null,
                });
            }

            const blocked = await assertMayPost(req.user?._id, res);
            if (blocked) return blocked;

            const capExceeded = await assertWithinPostLimit(req.user?._id, content, res);
            if (capExceeded) return capExceeded;

            // Same two filters the read paths use. Without them a post that is hidden
            // pending review, or whose author has blocked this user, is still writable
            // by anyone holding its id — moderation you can walk around by replying.
            const post = await VivaClubPostModel.findOne({
                _id: id,
                ...visibleContentFilter(),
                user: { $nin: await invisibleAuthorsFor(req.user?._id) },
            }).populate("user");

            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null,
                });
            }

            const newComment = await VivaClubCommentModel.create({
                post: id,
                user: req.user?._id,
                content,
            });

            // Fetch the commenter's details to get their name
            const commenter = await UserModel.findById(req.user?._id);
            const commenterName = commenter?.onboarding_data?.preferred_name || "Someone";

            // Notify post author if it's not their own comment
            const postAuthor: any = post.user;
            if (
                postAuthor &&
                postAuthor._id.toString() !== req.user?._id.toString() &&
                postAuthor.FCM_token
            ) {
                await sendPushNotification({
                    token: postAuthor.FCM_token,
                    title: "New Comment",
                    body: `${commenterName} commented on your post.`,
                    data: {
                        type: "VIVA_CLUB_COMMENT",
                        postId: id,
                    },
                });
            }

            return sendResponse({
                response: res,
                statusCode: StatusCodes.CREATED,
                message: "Comment added successfully",
                success: true,
                data: newComment,
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null,
            });
        }
    };

    /**
     * Toggle like on a post
     */
    toggleLike = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const userId = req.user?._id;

            // Liking is a write too: hidden content and blocked authors are off limits.
            const post = await VivaClubPostModel.findOne({
                _id: id,
                ...visibleContentFilter(),
                user: { $nin: await invisibleAuthorsFor(userId) },
            });
            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null,
                });
            }

            const likeIndex = post.likes.indexOf(userId as any);
            if (likeIndex > -1) {
                post.likes.splice(likeIndex, 1);
            } else {
                post.likes.push(userId as any);
            }

            await post.save();

            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                message: "Like toggled",
                success: true,
                data: {
                    totalLikes: post.likes.length,
                    isLiked: post.likes.includes(userId as any),
                },
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null,
            });
        }
    };
}
