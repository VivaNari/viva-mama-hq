/**
 * Who may touch a Viva AI message.
 *
 * Both endpoints that take a message id from the client are covered here, because they
 * share one control and one failure mode. `messages.userId` is a plain String rather
 * than a ref, so nothing in Mongoose enforces the relationship — the check has to be
 * written, and it was missing.
 *
 * The bookmark hole was live: `createBookmark` stored any id it was handed, and
 * `getUserBookmarks` populates the message in full, so an authenticated user could
 * bookmark someone else's id and read their private AI health conversation out of an
 * endpoint that appears to return only your own data. ObjectIds embed a timestamp and a
 * counter, so ids are guessable in bulk rather than needing to be stolen.
 *
 * Both endpoints answer **404, never 403**, for an id that is not yours. A 403 confirms
 * the id exists, which is most of what enumeration is trying to learn.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { Types } from "mongoose";

import AIBookmarkController from "../src/api/v1/controllers/ai-message-bookmark/ai-message-bookmark.controller";
import bookmarkValidator from "../src/api/v1/validators/ai-message-bookmark/ai-message-bookmark.validator";
import aiMessageBookmarkModel from "../src/models/ai-message-bookmark.model";
import messageModel from "../src/models/message.model";
import reportModel from "../src/models/report.model";
import UserModel from "../src/models/user.model";
import VivaClubPostModel from "../src/models/vivaClubPost.model";
import {
    AI_REPORTS_PER_DAY,
    ModerationError,
    ModerationService,
} from "../src/services/vivaClub/moderation.service";
import { MessageRoleEnum, MessageTypeEnum } from "../src/types/chat.types";
import {
    EReportAction,
    EReportReason,
    EReportTargetType,
} from "../src/types/moderation.types";
import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";

jest.setTimeout(120000);

const bookmarks = new AIBookmarkController();
const moderation = new ModerationService();

beforeAll(connectTestDb);
afterAll(closeTestDb);
afterEach(clearTestDb);

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

const makeUser = (n: number) => UserModel.create({ mobile_number: `91111111${n}` });

const makeAiMessage = (
    ownerId: unknown,
    text = "an assistant reply",
    extra: Record<string, unknown> = {},
) =>
    messageModel.create({
        conversationId: new Types.ObjectId(),
        userId: String(ownerId),
        role: MessageRoleEnum.ASSITANT,
        type: MessageTypeEnum.AI,
        text,
        ...extra,
    });

const reportAi = (reporterId: unknown, messageId: string, reason = EReportReason.HARMFUL_ADVICE) =>
    moderation.reportAiMessage({ reporterId, messageId, reason });

/** The ModerationError code a call rejected with, or null if it resolved. */
const denialCode = async (run: Promise<unknown>): Promise<string | null> => {
    try {
        await run;
        return null;
    } catch (error) {
        if (error instanceof ModerationError) return error.code;
        throw error;
    }
};

const bookmark = async (userId: unknown, messageId: string) => {
    const { res, captured } = fakeRes();
    await bookmarks.createBookmark(
        { user: { _id: userId }, body: { messageId } } as any,
        res,
        jest.fn(),
    );
    return captured;
};

const listBookmarks = async (userId: unknown) => {
    const { res, captured } = fakeRes();
    await bookmarks.getUserBookmarks({ user: { _id: userId } } as any, res, jest.fn());
    return captured;
};

describe("bookmarking someone else's AI message", () => {
    it("is refused, and stores nothing", async () => {
        const alice = await makeUser(1);
        const bob = await makeUser(2);
        const bobsMessage = await makeAiMessage(bob._id, "BOB'S PRIVATE CONVERSATION");

        const out = await bookmark(alice._id, String(bobsMessage._id));

        expect(out.statusCode).toBe(404);
        expect(await aiMessageBookmarkModel.countDocuments({})).toBe(0);
    });

    it("does not leak the text even if such a row already exists", async () => {
        // Written straight to the collection, standing in for the rows the live database
        // may already hold from before the check existed. The read path has to filter
        // them too, or fixing the write path only protects future mistakes.
        const alice = await makeUser(1);
        const bob = await makeUser(2);
        const bobsMessage = await makeAiMessage(bob._id, "BOB'S PRIVATE CONVERSATION");
        await aiMessageBookmarkModel.create({
            userId: alice._id,
            messageId: bobsMessage._id,
        });

        const listed = await listBookmarks(alice._id);

        expect(JSON.stringify(listed.body.data)).not.toContain("BOB'S PRIVATE");
        expect(listed.body.data).toHaveLength(0);
    });

    it("still lets you bookmark and read your own", async () => {
        const alice = await makeUser(1);
        const hers = await makeAiMessage(alice._id, "her own reply");

        const out = await bookmark(alice._id, String(hers._id));
        const listed = await listBookmarks(alice._id);

        expect(out.statusCode).toBe(200);
        expect(listed.body.data).toHaveLength(1);
        expect(JSON.stringify(listed.body.data)).toContain("her own reply");
    });

    it("refuses an id that matches no message at all", async () => {
        const alice = await makeUser(1);

        const out = await bookmark(alice._id, String(new Types.ObjectId()));

        expect(out.statusCode).toBe(404);
    });

    it("drops a row whose message is gone rather than returning a null", async () => {
        // The shape left behind when the hole above was exploited and the victim then
        // deleted their account: the bookmark survives, the message does not, and
        // populate resolves to null. The app maps this list straight onto `messageId`
        // and keys the list on `_id`, so returning the null would crash the screen.
        const alice = await makeUser(1);
        await aiMessageBookmarkModel.create({
            userId: alice._id,
            messageId: new Types.ObjectId(),
        });

        const listed = await listBookmarks(alice._id);

        expect(listed.body.data).toHaveLength(0);
    });

    // Asserted against the validator rather than through `bookmark()`, which calls the
    // controller directly and so never runs the route's middleware. This is the layer
    // that has to reject it: the controller's `findById` throws on a value Mongoose
    // cannot cast, which would surface as a 500 instead of a refusal.
    it("rejects a messageId that is not an ObjectId before it reaches the controller", () => {
        expect(bookmarkValidator.validate({ messageId: "not-an-object-id" }).error)
            .toBeDefined();
        expect(bookmarkValidator.validate({ messageId: String(new Types.ObjectId()) }).error)
            .toBeUndefined();
    });
});

describe("flagging a Viva AI reply", () => {
    it("captures the reply and the question that produced it", async () => {
        const alice = await makeUser(1);
        const conversationId = new Types.ObjectId();

        await messageModel.create({
            conversationId,
            userId: String(alice._id),
            role: MessageRoleEnum.USER,
            type: MessageTypeEnum.AI,
            text: "is it safe to take ibuprofen while breastfeeding?",
            createdAt: new Date(Date.now() - 60000),
        });
        const reply = await messageModel.create({
            conversationId,
            userId: String(alice._id),
            role: MessageRoleEnum.ASSITANT,
            type: MessageTypeEnum.AI,
            text: "a dangerous answer",
        });

        await reportAi(alice._id, String(reply._id));

        const report = await reportModel.findOne({}).lean();
        expect(report?.targetType).toBe(EReportTargetType.AI_MESSAGE);
        // Without the question, a reviewer cannot judge the answer or tune the prompt.
        expect(report?.snapshot).toBe("a dangerous answer");
        expect(report?.contextSnapshot).toBe(
            "is it safe to take ibuprofen while breastfeeding?",
        );
        // No user wrote it, so there is nobody to ban — this is what makes BAN_AUTHOR
        // inapplicable below.
        expect(report?.targetAuthor).toBeNull();
    });

    it("refuses someone else's message, and stores nothing", async () => {
        const alice = await makeUser(1);
        const bob = await makeUser(2);
        const bobsReply = await makeAiMessage(bob._id, "BOB'S PRIVATE CONVERSATION");

        // NOT_FOUND rather than FORBIDDEN: a distinguishable refusal would confirm the
        // id is real, which is most of what enumeration wants.
        expect(await denialCode(reportAi(alice._id, String(bobsReply._id)))).toBe("NOT_FOUND");
        expect(await reportModel.countDocuments({})).toBe(0);
    });

    it("refuses her own message to the AI — only its replies are reportable", async () => {
        const alice = await makeUser(1);
        const hers = await makeAiMessage(alice._id, "her question", {
            role: MessageRoleEnum.USER,
        });

        expect(await denialCode(reportAi(alice._id, String(hers._id)))).toBe("NOT_FOUND");
        expect(await reportModel.countDocuments({})).toBe(0);
    });

    it("refuses guided-flow messages, which are scripted rather than generated", async () => {
        const alice = await makeUser(1);
        const guided = await makeAiMessage(alice._id, "a check-in question", {
            type: MessageTypeEnum.GUIDED,
        });

        expect(await denialCode(reportAi(alice._id, String(guided._id)))).toBe("NOT_FOUND");
    });

    it("treats a repeat report as already handled rather than an error", async () => {
        const alice = await makeUser(1);
        const reply = await makeAiMessage(alice._id);

        const first = await reportAi(alice._id, String(reply._id));
        const second = await reportAi(alice._id, String(reply._id));

        expect(first.alreadyReported).toBe(false);
        expect(second.alreadyReported).toBe(true);
        expect(await reportModel.countDocuments({})).toBe(1);
    });

    it("copes with a reply that has no preceding question", async () => {
        const alice = await makeUser(1);
        const orphan = await makeAiMessage(alice._id, "an opening line");

        await reportAi(alice._id, String(orphan._id));

        const report = await reportModel.findOne({}).lean();
        expect(report?.contextSnapshot).toBeNull();
    });

    it("caps how many can be filed in a day", async () => {
        const alice = await makeUser(1);
        for (let i = 0; i < AI_REPORTS_PER_DAY; i++) {
            const reply = await makeAiMessage(alice._id, `reply ${i}`);
            await reportAi(alice._id, String(reply._id));
        }

        const oneMore = await makeAiMessage(alice._id, "one too many");

        // The unique index stops the same message being reported twice; nothing stopped
        // someone walking their whole history until this.
        expect(await denialCode(reportAi(alice._id, String(oneMore._id)))).toBe("RATE_LIMITED");
        expect(await reportModel.countDocuments({})).toBe(AI_REPORTS_PER_DAY);
    });

    it("does not count a different user's reports towards that cap", async () => {
        const alice = await makeUser(1);
        const bob = await makeUser(2);
        for (let i = 0; i < AI_REPORTS_PER_DAY; i++) {
            const reply = await makeAiMessage(alice._id, `reply ${i}`);
            await reportAi(alice._id, String(reply._id));
        }

        const bobsReply = await makeAiMessage(bob._id, "bob's first report");

        expect(await denialCode(reportAi(bob._id, String(bobsReply._id)))).toBeNull();
    });
});

describe("reviewing an AI report", () => {
    const reportedReply = async () => {
        const alice = await makeUser(1);
        const reply = await makeAiMessage(alice._id, "a dangerous answer");
        await reportAi(alice._id, String(reply._id));
        const report = await reportModel.findOne({}).lean();
        return { admin: await makeUser(9), reply, reportId: String(report!._id) };
    };

    it.each([EReportAction.REMOVE, EReportAction.BAN_AUTHOR])(
        "refuses %s, which has nothing to act on",
        async (action) => {
            const { admin, reply, reportId } = await reportedReply();

            const code = await denialCode(
                moderation.actionReport({ reportId, action, reviewerId: admin._id }),
            );

            expect(code).toBe("UNSUPPORTED");
            // The real damage this guard prevents: REMOVE would have written a
            // `moderation` key onto a message document, inventing a field the chat read
            // path knows nothing about.
            const after = await messageModel.findById(reply._id).lean();
            expect(after).not.toHaveProperty("moderation");
        },
    );

    it("acknowledges a report without pretending anything was removed", async () => {
        const { admin, reportId } = await reportedReply();

        await moderation.actionReport({
            reportId,
            action: EReportAction.ACKNOWLEDGE,
            reviewerId: admin._id,
            note: "prompt tuned",
        });

        const after = await reportModel.findById(reportId).lean();
        expect(after?.status).toBe("ACTIONED");
        expect(after?.reviewerNote).toBe("prompt tuned");
    });

    it("still removes community content, which does have something to act on", async () => {
        // Guards the guard: if ACTIONABLE_CONTENT_TYPES were ever emptied or inverted,
        // every test above would still pass while moderation quietly stopped working.
        const author = await makeUser(1);
        const reporter = await makeUser(2);
        const admin = await makeUser(9);
        const post = await VivaClubPostModel.create({ user: author._id, content: "hi" });
        await moderation.report({
            reporterId: reporter._id,
            targetType: EReportTargetType.VIVA_CLUB_POST,
            targetId: String(post._id),
            reason: EReportReason.SPAM,
        });
        const report = await reportModel.findOne({}).lean();

        await moderation.actionReport({
            reportId: String(report!._id),
            action: EReportAction.REMOVE,
            reviewerId: admin._id,
        });

        const after = await VivaClubPostModel.findById(post._id).lean();
        expect(after?.moderation?.status).toBe("REMOVED");
    });
});
