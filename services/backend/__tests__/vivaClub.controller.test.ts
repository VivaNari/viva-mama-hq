/**
 * Unit / API tests for the VivaClub discussion forum (VivaClub Community — Activity 2).
 *
 * Strategy:
 *  - Stub firebase / redis so importing the app stays cheap.
 *  - Pass-through auth that injects a test user.
 *  - Replace VivaClubService (default export) with an in-memory fake implementing
 *    getPosts / createPost / getPostDetails / addComment / toggleLike so we verify
 *    route wiring, pagination envelope, validation and like-toggle semantics
 *    WITHOUT a live MongoDB or a real FCM push.
 *
 * Run:  NODE_ENV=test npx jest vivaClub.controller
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// Importing `app` loads the route index, which constructs PaymentService -> new Razorpay()
// at module load. Stub razorpay so it doesn't demand real API keys (mirrors payments_selectFreePlan.test.ts).
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    }));
});

jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () =>
    jest.fn(() => (req: any, _res: any, next: any) => {
        req.user = { _id: "u_test_1" };
        next();
    }),
);

// Minimal in-memory store shared across the fake service instance.
const store: any = {
    posts: [
        {
            _id: "post1",
            user: { _id: "u_author", user_name: "Asha" },
            content: "First night with the baby — any tips?",
            mediaUrls: [],
            likes: [] as string[],
            commentCount: 0,
            createdAt: new Date().toISOString(),
        },
    ],
};

jest.mock(require.resolve("../src/services/vivaClub/vivaClub.service"), () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        getPosts: (req: any, res: any) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            return res.status(200).json({
                success: true,
                message: "Posts fetched successfully",
                data: {
                    posts: store.posts,
                    pagination: { currentPage: page, totalPages: 1, totalPosts: store.posts.length, limit },
                },
            });
        },
        createPost: (req: any, res: any) => {
            if (!req.body?.content) {
                return res.status(400).json({ success: false, message: "Content is required" });
            }
            const post = {
                _id: "post_new",
                user: { _id: req.user._id },
                content: req.body.content,
                mediaUrls: req.body.mediaUrls || [],
                likes: [],
            };
            store.posts.unshift(post);
            return res.status(201).json({ success: true, message: "Post created successfully", data: post });
        },
        getPostDetails: (req: any, res: any) => {
            const post = store.posts.find((p: any) => p._id === req.params.id);
            if (!post) return res.status(404).json({ success: false, message: "Post not found" });
            return res
                .status(200)
                .json({ success: true, message: "Post details fetched", data: { ...post, comments: [] } });
        },
        addComment: (req: any, res: any) => {
            if (!req.body?.content) {
                return res.status(400).json({ success: false, message: "Comment content is required" });
            }
            const post = store.posts.find((p: any) => p._id === req.params.id);
            if (!post) return res.status(404).json({ success: false, message: "Post not found" });
            return res
                .status(201)
                .json({ success: true, message: "Comment added successfully", data: { _id: "c_new" } });
        },
        toggleLike: (req: any, res: any) => {
            const post = store.posts.find((p: any) => p._id === req.params.id);
            if (!post) return res.status(404).json({ success: false, message: "Post not found" });
            const idx = post.likes.indexOf(req.user._id);
            if (idx > -1) post.likes.splice(idx, 1);
            else post.likes.push(req.user._id);
            return res.status(200).json({
                success: true,
                message: "Like toggled",
                data: { totalLikes: post.likes.length, isLiked: post.likes.includes(req.user._id) },
            });
        },
    })),
}));

import request from "supertest";
import app from "../src/app";

describe("VivaClub Discussion Forum API", () => {
    describe("GET /api/v1/viva-club/posts", () => {
        it("returns 200 with a paginated feed", async () => {
            const res = await request(app).get("/api/v1/viva-club/posts?page=1&limit=10");
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.posts)).toBe(true);
            expect(res.body.data.pagination.currentPage).toBe(1);
        });
    });

    describe("POST /api/v1/viva-club/posts", () => {
        it("creates a post (201) when content is present", async () => {
            const res = await request(app)
                .post("/api/v1/viva-club/posts")
                .send({ content: "How do you handle cluster feeding?" });
            expect(res.status).toBe(201);
            expect(res.body.data.content).toContain("cluster feeding");
        });

        it("rejects an empty post with 400", async () => {
            const res = await request(app).post("/api/v1/viva-club/posts").send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe("GET /api/v1/viva-club/posts/:id", () => {
        it("returns 200 with details for an existing post", async () => {
            const res = await request(app).get("/api/v1/viva-club/posts/post1");
            expect(res.status).toBe(200);
            expect(res.body.data._id).toBe("post1");
            expect(Array.isArray(res.body.data.comments)).toBe(true);
        });

        it("returns 404 for a missing post", async () => {
            const res = await request(app).get("/api/v1/viva-club/posts/nope");
            expect(res.status).toBe(404);
        });
    });

    describe("POST /api/v1/viva-club/posts/:id/comments", () => {
        it("adds a comment (201)", async () => {
            const res = await request(app)
                .post("/api/v1/viva-club/posts/post1/comments")
                .send({ content: "Hang in there, it gets easier!" });
            expect(res.status).toBe(201);
            expect(res.body.message).toMatch(/added/i);
        });

        it("rejects an empty comment with 400", async () => {
            const res = await request(app).post("/api/v1/viva-club/posts/post1/comments").send({});
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/v1/viva-club/posts/:id/like", () => {
        it("toggles like on then off across two calls", async () => {
            const first = await request(app).post("/api/v1/viva-club/posts/post1/like").send({});
            expect(first.status).toBe(200);
            expect(first.body.data.isLiked).toBe(true);
            expect(first.body.data.totalLikes).toBe(1);

            const second = await request(app).post("/api/v1/viva-club/posts/post1/like").send({});
            expect(second.body.data.isLiked).toBe(false);
            expect(second.body.data.totalLikes).toBe(0);
        });
    });
});