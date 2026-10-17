/**
 * Moderation behaviour, against a real in-memory MongoDB.
 *
 * Deliberately NOT the approach in vivaClub.controller.test.ts, which replaces the
 * service with an in-memory fake and therefore only proves the routes are wired up.
 * Everything here — the auto-hide threshold, the "not hidden" read filter, the
 * ownership check — is database behaviour, and a fake would assert nothing about it.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn(async () => undefined),
}));

import { Types } from "mongoose";

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import reportModel from "../src/models/report.model";
import UserModel from "../src/models/user.model";
import VivaClubCommentModel from "../src/models/vivaClubComment.model";
import VivaClubPostModel from "../src/models/vivaClubPost.model";
import { ModerationError, ModerationService } from "../src/services/vivaClub/moderation.service";
import {
    CURRENT_COMMUNITY_GUIDELINES_VERSION,
    COMMUNITY_GUIDELINES_CONSENT,
} from "../src/services/vivaClub/posting-gate";
import VivaClubService from "../src/services/vivaClub/vivaClub.service";
import {
    EModerationStatus,
    EReportAction,
    EReportReason,
    EReportStatus,
    EReportTargetType,
} from "../src/types/moderation.types";

jest.setTimeout(120000);

const moderation = new ModerationService();
const vivaClub = new VivaClubService();

beforeAll(connectTestDb);
afterAll(closeTestDb);
afterEach(clearTestDb);

/** Captures whatever sendResponse writes, so real handlers can be asserted on. */
function fakeRes() {
    const captured: { statusCode?: number; body?: any } = {};
    const res: any = {
        status(code: number) {
            captured.statusCode = code;
            return res;
        },
        json(body: any) {
            captured.body = body;
            return res;
        },
    };
    return { res, captured };
}

const makeUser = (n: number, extra: Record<string, unknown> = {}) =>
    UserModel.create({
        mobile_number: `90000000${n}`,
        consents: [
            {
                type: COMMUNITY_GUIDELINES_CONSENT,
                version: CURRENT_COMMUNITY_GUIDELINES_VERSION,
                acceptedAt: new Date(),
            },
        ],
        ...extra,
    });

const makePost = (author: Types.ObjectId, content = "hello") =>
    VivaClubPostModel.create({ user: author, content });

describe("reporting and the auto-hide threshold", () => {
    it("hides content once three distinct people report it", async () => {
        const author = await makeUser(1);
        const post = await makePost(author._id as never);

        for (const n of [2, 3]) {
            const reporter = await makeUser(n);
            const r = await moderation.report({
                reporterId: reporter._id,
                targetType: EReportTargetType.VIVA_CLUB_POST,
                targetId: String(post._id),
                reason: EReportReason.SPAM,
            });
            expect(r.hidden).toBe(false);
        }

        const third = await makeUser(4);
        const result = await moderation.report({
            reporterId: third._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.HARASSMENT,
        });

        expect(result.hidden).toBe(true);
        const after = await VivaClubPostModel.findById(post._id).lean();
        expect(after?.moderation?.status).toBe(EModerationStatus.AUTO_HIDDEN);
        expect(after?.moderation?.reportCount).toBe(3);
    });

    it("does not let one person hide a post by reporting three times", async () => {
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const post = await makePost(author._id as never);

        const args = {
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.SPAM,
        };
        await moderation.report(args);
        const second = await moderation.report(args);
        const third = await moderation.report(args);

        // The unique index turns repeats into no-ops rather than errors.
        expect(second.alreadyReported).toBe(true);
        expect(third.alreadyReported).toBe(true);
        expect(await reportModel.countDocuments({})).toBe(1);

        const after = await VivaClubPostModel.findById(post._id).lean();
        expect(after?.moderation?.status ?? EModerationStatus.VISIBLE).toBe(
            EModerationStatus.VISIBLE,
        );
    });

    it("snapshots the content, so a report survives the author deleting it", async () => {
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const post = await makePost(author._id as never, "something objectionable");

        await moderation.report({
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.HATE,
        });
        await moderation.deleteOwnContent({
            userId: author._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
        });

        const report = await reportModel.findOne({}).lean();
        expect(report?.snapshot).toBe("something objectionable");
    });
});

describe("feed visibility", () => {
    const getFeed = async (viewerId: unknown) => {
        const { res, captured } = fakeRes();
        await vivaClub.getPosts({ query: {}, user: { _id: viewerId } } as any, res);
        return captured.body.data;
    };

    it("keeps posts that predate the moderation field visible", async () => {
        const author = await makeUser(1);
        const viewer = await makeUser(2);

        // Inserted through the driver so it has no `moderation` key at all — exactly
        // what every row in the live database looks like today. A read filter written
        // as `status === VISIBLE` would drop this and empty the feed on deploy.
        await VivaClubPostModel.collection.insertOne({
            user: author._id,
            content: "legacy post",
            likes: [],
            mediaUrls: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        } as never);

        const feed = await getFeed(viewer._id);
        expect(feed.posts).toHaveLength(1);
        expect(feed.pagination.totalPosts).toBe(1);
    });

    it("drops hidden posts from both the page and the total", async () => {
        const author = await makeUser(1);
        const viewer = await makeUser(2);
        await makePost(author._id as never, "visible");
        const hidden = await makePost(author._id as never, "hidden");
        await VivaClubPostModel.updateOne(
            { _id: hidden._id },
            { $set: { "moderation.status": EModerationStatus.AUTO_HIDDEN } },
        );

        const feed = await getFeed(viewer._id);
        expect(feed.posts).toHaveLength(1);
        // The count has to use the same filter as the query, or the reader pages into
        // a screen that renders nothing.
        expect(feed.pagination.totalPosts).toBe(1);
    });

    it("hides a blocked author's posts from the blocker, and vice versa", async () => {
        const blocker = await makeUser(1);
        const blocked = await makeUser(2);
        await makePost(blocked._id as never, "from the blocked user");
        await makePost(blocker._id as never, "from the blocker");

        await moderation.setBlocked(blocker._id, String(blocked._id), true);

        const blockerFeed = await getFeed(blocker._id);
        expect(blockerFeed.posts.map((p: any) => p.content)).toEqual(["from the blocker"]);

        // Blocking has to cut both ways. If it only hid the blocked user's content from
        // the blocker, someone being harassed would lose sight of their harasser while
        // the harasser kept a clear view of them.
        const blockedFeed = await getFeed(blocked._id);
        expect(blockedFeed.posts.map((p: any) => p.content)).toEqual([
            "from the blocked user",
        ]);
    });

    it("404s a direct link to a hidden post rather than rendering it", async () => {
        const author = await makeUser(1);
        const viewer = await makeUser(2);
        const post = await makePost(author._id as never);
        await VivaClubPostModel.updateOne(
            { _id: post._id },
            { $set: { "moderation.status": EModerationStatus.REMOVED } },
        );

        const { res, captured } = fakeRes();
        await vivaClub.getPostDetails(
            { params: { id: String(post._id) }, user: { _id: viewer._id } } as any,
            res,
        );

        expect(captured.statusCode).toBe(404);
    });

    it("filters blocked users' comments out of a visible post", async () => {
        const author = await makeUser(1);
        const viewer = await makeUser(2);
        const troll = await makeUser(3);
        const post = await makePost(author._id as never);
        await VivaClubCommentModel.create({ post: post._id, user: troll._id, content: "bad" });
        await VivaClubCommentModel.create({ post: post._id, user: author._id, content: "ok" });

        await moderation.setBlocked(viewer._id, String(troll._id), true);

        const { res, captured } = fakeRes();
        await vivaClub.getPostDetails(
            { params: { id: String(post._id) }, user: { _id: viewer._id } } as any,
            res,
        );

        expect(captured.body.data.comments.map((c: any) => c.content)).toEqual(["ok"]);
    });
});

describe("deleting your own content", () => {
    it("removes the post and cascades its comments", async () => {
        const author = await makeUser(1);
        const other = await makeUser(2);
        const post = await makePost(author._id as never);
        await VivaClubCommentModel.create({ post: post._id, user: other._id, content: "theirs" });

        await moderation.deleteOwnContent({
            userId: author._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
        });

        expect(await VivaClubPostModel.countDocuments({})).toBe(0);
        // Otherwise the comment survives pointing at a post that no longer exists.
        expect(await VivaClubCommentModel.countDocuments({})).toBe(0);
    });

    it("refuses to delete someone else's content", async () => {
        const author = await makeUser(1);
        const stranger = await makeUser(2);
        const post = await makePost(author._id as never);

        await expect(
            moderation.deleteOwnContent({
                userId: stranger._id,
                targetType: EReportTargetType.VIVA_CLUB_POST,
                targetId: String(post._id),
            }),
        ).rejects.toBeInstanceOf(ModerationError);

        expect(await VivaClubPostModel.countDocuments({})).toBe(1);
    });
});

describe("blocking", () => {
    it("refuses self-blocking", async () => {
        const user = await makeUser(1);
        await expect(
            moderation.setBlocked(user._id, String(user._id), true),
        ).rejects.toBeInstanceOf(ModerationError);
    });

    it("unblocks", async () => {
        const a = await makeUser(1);
        const b = await makeUser(2);
        await moderation.setBlocked(a._id, String(b._id), true);
        await moderation.setBlocked(a._id, String(b._id), false);

        const fresh = await UserModel.findById(a._id).lean();
        expect(fresh?.blockedUsers ?? []).toHaveLength(0);
    });
});

describe("posting gate", () => {
    const createPost = async (userId: unknown, body: Record<string, unknown>) => {
        const { res, captured } = fakeRes();
        await vivaClub.createPost({ body, user: { _id: userId } } as any, res);
        return captured;
    };

    it("refuses to post without accepting the community guidelines", async () => {
        // No consents — the UGC policy requires acceptance *before* content is created,
        // which includes users who registered before the guidelines existed.
        const user = await UserModel.create({ mobile_number: "9111111111" });

        const out = await createPost(user._id, { content: "hi" });

        expect(out.statusCode).toBe(403);
        expect(out.body.data.code).toBe("GUIDELINES_NOT_ACCEPTED");
        expect(await VivaClubPostModel.countDocuments({})).toBe(0);
    });

    it("refuses to post when community-banned", async () => {
        const user = await makeUser(1, { communityBanned: true });

        const out = await createPost(user._id, { content: "hi" });

        expect(out.statusCode).toBe(403);
        expect(out.body.data.code).toBe("COMMUNITY_BANNED");
    });

    it("rejects attachments, which no client can produce", async () => {
        const user = await makeUser(1);

        const out = await createPost(user._id, {
            content: "hi",
            mediaUrls: ["https://example.com/x.jpg"],
        });

        expect(out.statusCode).toBe(400);
        expect(out.body.data.code).toBe("MEDIA_NOT_SUPPORTED");
    });

    it("actually stops an over-cap post, not just answers 402", async () => {
        // Regression. The guard used to `return sendResponse(...)`, and sendResponse
        // returns undefined, so `if (capExceeded)` never fired: the server wrote a 402
        // and then created the post regardless — two responses, cap enforced nowhere.
        const user = await makeUser(1); // FREE tier: 150 characters

        const out = await createPost(user._id, { content: "x".repeat(500), mediaUrls: [] });

        expect(out.statusCode).toBe(402);
        expect(await VivaClubPostModel.countDocuments({})).toBe(0);
    });

    it("allows a post once the guidelines are accepted", async () => {
        const user = await makeUser(1);

        const out = await createPost(user._id, { content: "hi", mediaUrls: [] });

        expect(out.statusCode).toBe(201);
        expect(await VivaClubPostModel.countDocuments({})).toBe(1);
    });
});

describe("admin queue", () => {
    it("sorts self-harm reports ahead of older ones", async () => {
        const author = await makeUser(1);
        const spamReporter = await makeUser(2);
        const welfareReporter = await makeUser(3);
        const spamPost = await makePost(author._id as never, "spam");
        const welfarePost = await makePost(author._id as never, "worrying");

        await moderation.report({
            reporterId: spamReporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(spamPost._id),
            reason: EReportReason.SPAM,
        });
        await moderation.report({
            reporterId: welfareReporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(welfarePost._id),
            reason: EReportReason.SELF_HARM,
        });

        const { reports } = await moderation.listReports({ page: 1, limit: 10 });

        // Reported later, but it comes first: in a postpartum mental-health community a
        // self-harm report is a welfare signal, not a content complaint.
        expect(reports[0].reason).toBe(EReportReason.SELF_HARM);
    });

    it("REMOVE marks the content rather than deleting it", async () => {
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const reviewer = await makeUser(3);
        const post = await makePost(author._id as never);
        await moderation.report({
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.HATE,
        });
        const report = await reportModel.findOne({}).lean();

        await moderation.actionReport({
            reportId: String(report?._id),
            action: EReportAction.REMOVE,
            reviewerId: reviewer._id,
        });

        // Kept, so "why did my post disappear?" can be answered.
        const after = await VivaClubPostModel.findById(post._id).lean();
        expect(after).not.toBeNull();
        expect(after?.moderation?.status).toBe(EModerationStatus.REMOVED);
    });

    it("DISMISS restores the content and resets the count", async () => {
        const author = await makeUser(1);
        const reviewer = await makeUser(9);
        const post = await makePost(author._id as never);
        for (const n of [2, 3, 4]) {
            const r = await makeUser(n);
            await moderation.report({
                reporterId: r._id,
                targetType: EReportTargetType.VIVA_CLUB_POST,
                targetId: String(post._id),
                reason: EReportReason.SPAM,
            });
        }
        const report = await reportModel.findOne({}).lean();

        await moderation.actionReport({
            reportId: String(report?._id),
            action: EReportAction.DISMISS,
            reviewerId: reviewer._id,
        });

        const after = await VivaClubPostModel.findById(post._id).lean();
        expect(after?.moderation?.status).toBe(EModerationStatus.VISIBLE);
        // Reset, or the very next single report would re-trip a threshold a human has
        // already judged not to apply.
        expect(after?.moderation?.reportCount).toBe(0);
        expect(await reportModel.countDocuments({ status: EReportStatus.DISMISSED })).toBe(3);
    });

    it("BAN_AUTHOR bars posting but leaves the rest of the account alone", async () => {
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const reviewer = await makeUser(3);
        const post = await makePost(author._id as never);
        await moderation.report({
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.HARASSMENT,
        });
        const report = await reportModel.findOne({}).lean();

        await moderation.actionReport({
            reportId: String(report?._id),
            action: EReportAction.BAN_AUTHOR,
            reviewerId: reviewer._id,
        });

        const banned = await UserModel.findById(author._id).lean();
        expect(banned?.communityBanned).toBe(true);
        // A ban is a community sanction, not a withdrawal of health services.
        expect(banned).not.toBeNull();
    });
});

/**
 * Regressions from a feature-level audit of this change.
 *
 * Every one of these passed a read-through and failed the moment it was exercised. The
 * first round of tests covered the read paths and the service, and left the *write*
 * paths — commenting, liking — and the feed's own comment count untested, which is
 * exactly where moderation turned out to be bypassable.
 */
describe("audit regressions", () => {
    /**
     * Found in the field, not by these tests. `addComment` gates on the guidelines just
     * as `createPost` does — correctly, a comment is content — but nothing asserted it,
     * and the app only ever showed the acceptance sheet on the composer. A new user's
     * first comment hit a refusal with no way through it.
     *
     * The second half is the code on the body. The app ends the session on a 403 that
     * carries no recognisable denial code, so a refusal without one signs the user out
     * mid-comment — which is how this was found.
     */
    it("refuses a comment without accepted guidelines, carrying a code", async () => {
        const author = await makeUser(1);
        const newcomer = await UserModel.create({ mobile_number: "9222222222" });
        const post = await makePost(author._id as never);

        const { res, captured } = fakeRes();
        await vivaClub.addComment(
            {
                params: { id: String(post._id) },
                body: { content: "hi" },
                user: { _id: newcomer._id },
            } as any,
            res,
        );

        expect(captured.statusCode).toBe(403);
        expect(captured.body.data.code).toBe("GUIDELINES_NOT_ACCEPTED");
        expect(await VivaClubCommentModel.countDocuments({})).toBe(0);
    });

    it("lets the same user comment once the guidelines are accepted", async () => {
        const author = await makeUser(1);
        const newcomer = await makeUser(2);
        const post = await makePost(author._id as never);

        const { res, captured } = fakeRes();
        await vivaClub.addComment(
            {
                params: { id: String(post._id) },
                body: { content: "hi" },
                user: { _id: newcomer._id },
            } as any,
            res,
        );

        expect(captured.statusCode).toBe(201);
        expect(await VivaClubCommentModel.countDocuments({})).toBe(1);
    });

    it("refuses a comment on a post that is hidden pending review", async () => {
        const author = await makeUser(1);
        const other = await makeUser(2);
        const post = await makePost(author._id as never);
        await VivaClubPostModel.updateOne(
            { _id: post._id },
            { $set: { "moderation.status": EModerationStatus.AUTO_HIDDEN } },
        );

        const { res, captured } = fakeRes();
        await vivaClub.addComment(
            {
                params: { id: String(post._id) },
                body: { content: "hi" },
                user: { _id: other._id },
            } as any,
            res,
        );

        // Otherwise moderation is walkable: hidden to read, still writable by id.
        expect(captured.statusCode).toBe(404);
        expect(await VivaClubCommentModel.countDocuments({})).toBe(0);
    });

    it("refuses a comment on a post whose author has blocked me", async () => {
        const author = await makeUser(1);
        const blocked = await makeUser(2);
        await moderation.setBlocked(author._id, String(blocked._id), true);
        const post = await makePost(author._id as never);

        const { res, captured } = fakeRes();
        await vivaClub.addComment(
            {
                params: { id: String(post._id) },
                body: { content: "hi" },
                user: { _id: blocked._id },
            } as any,
            res,
        );

        expect(captured.statusCode).toBe(404);
    });

    it("refuses a like on a hidden post", async () => {
        const author = await makeUser(1);
        const other = await makeUser(2);
        const post = await makePost(author._id as never);
        await VivaClubPostModel.updateOne(
            { _id: post._id },
            { $set: { "moderation.status": EModerationStatus.AUTO_HIDDEN } },
        );

        const { res, captured } = fakeRes();
        await vivaClub.toggleLike(
            { params: { id: String(post._id) }, user: { _id: other._id } } as any,
            res,
        );

        expect(captured.statusCode).toBe(404);
    });

    it("counts only the comments the reader will actually be shown", async () => {
        const author = await makeUser(1);
        const viewer = await makeUser(2);
        const troll = await makeUser(3);
        const post = await makePost(author._id as never);
        await VivaClubCommentModel.create({
            post: post._id,
            user: troll._id,
            content: "bad",
        });
        await moderation.setBlocked(viewer._id, String(troll._id), true);

        const { res, captured } = fakeRes();
        await vivaClub.getPosts({ query: {}, user: { _id: viewer._id } } as any, res);

        // The card used to promise "1 comment" and the detail screen then opened empty,
        // because the count ignored blocking while the listing applied it.
        expect(captured.body.data.posts[0].commentCount).toBe(0);
    });

    it("populates reporter and author onto the admin queue rows", async () => {
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const post = await makePost(author._id as never);
        await moderation.report({
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.SPAM,
        });

        const { reports } = await moderation.listReports({ page: 1, limit: 10 });

        // listReports populates the output of an aggregate rather than a query, which is
        // a different Mongoose path — without this the queue would render "Unknown" for
        // every name and be unusable.
        expect((reports[0] as any).reporter?.mobile_number).toBe("900000002");
        expect((reports[0] as any).targetAuthor?.mobile_number).toBe("900000001");
    });

    it("refuses a report of your own content", async () => {
        const author = await makeUser(1);
        const post = await makePost(author._id as never);

        await expect(
            moderation.report({
                reporterId: author._id,
                targetType: EReportTargetType.VIVA_CLUB_POST,
                targetId: String(post._id),
                reason: EReportReason.SPAM,
            }),
        ).rejects.toBeInstanceOf(ModerationError);

        // Three self-reports are indistinguishable from three real ones at the
        // threshold, so this is not merely a pointless action.
        expect(await reportModel.countDocuments({})).toBe(0);
    });
});
