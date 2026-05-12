import { Request, Response } from "express";
import VivaClubPostModel from "../../models/vivaClubPost.model";
import VivaClubCommentModel from "../../models/vivaClubComment.model";
import UserModel from "../../models/user.model";
import { sendPushNotification } from "../../utils/sendPushNotification";
import BaseService from "../base.service";
import { IVivaClubPost } from "../../types/vivaClub.types";
import { StatusCodes } from "http-status-codes";
import sendResponse from "../../utils/commonFunctions/sendResponse";

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

            const posts = await VivaClubPostModel.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .lean();

            // Enhance posts with comment counts and like status
            const enhancedPosts = await Promise.all(posts.map(async (post: any) => {
                const commentCount = await VivaClubCommentModel.countDocuments({ post: post._id });
                const isLiked = post.likes.some((id: any) => id.toString() === req.user?._id.toString());
                
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
                };
            }));

            const totalPosts = await VivaClubPostModel.countDocuments();

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
                    }
                }
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null
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
                    data: null
                });
            }

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
                data: newPost
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null
            });
        }
    };

    /**
     * Get single post details with comments
     */
    getPostDetails = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const post = await VivaClubPostModel.findById(id)
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .lean();

            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null
                });
            }

            const comments = await VivaClubCommentModel.find({ post: id })
                .populate("user", "onboarding_data.preferred_name profile_picture")
                .sort({ createdAt: 1 })
                .lean();

            const isLiked = post.likes.some((id: any) => id.toString() === req.user?._id.toString());

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
                }
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null
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
                    data: null
                });
            }

            const post = await VivaClubPostModel.findById(id).populate("user");
            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null
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
            if (postAuthor && postAuthor._id.toString() !== req.user?._id.toString() && postAuthor.FCM_token) {
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
                data: newComment
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null
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

            const post = await VivaClubPostModel.findById(id);
            if (!post) {
                return sendResponse({
                    response: res,
                    statusCode: StatusCodes.NOT_FOUND,
                    message: "Post not found",
                    success: false,
                    data: null
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
                }
            });
        } catch (error: any) {
            return sendResponse({
                response: res,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                message: error.message,
                success: false,
                data: null
            });
        }
    };
}
