/**
 * Automation test — Mood Log API (Milestone 6 / mood-log module).
 *
 * Mirrors the repo's controller-test conventions (firebase/redis/razorpay + auth
 * middleware mocks, then `import app`). Unlike the controller-stub tests, this suite
 * mocks ONLY the Mongoose models (mood-log + user), so the REAL MoodLogController,
 * MoodLogService, Joi validator and date service all execute. That is what verifies
 * the actual business rules: validation, future-date / backdate-floor guards,
 * upsert (create-or-update), range query, and delete.
 *
 * Routes under test (all require the x-user header via the mocked auth middleware):
 *   GET    /api/v1/mood-logs
 *   POST   /api/v1/mood-logs
 *   DELETE /api/v1/mood-logs
 *
 * Run:  npx jest moodLog.controller
 */

// --- heavy side-effect modules so `import app` stays cheap (repo convention) ---
jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({
    __esModule: true,
    redisPublisher: null,
    redisSubscriber: null,
}));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn(), fetch: jest.fn() },
        payments: { fetch: jest.fn() },
    })),
);

// --- auth middleware: header mode injects req.user from x-user, else 401 ---
jest.mock(require.resolve("../src/middlewares/authorization.middleware"), () => ({
    __esModule: true,
    default: (mode: string) => (req: any, res: any, next: any) => {
        const uid = req.headers["x-user"];
        if (mode === "header" && !uid) {
            return res.status(401).json({ error: "Missing x-user header" });
        }
        req.user = { _id: uid || "u_test" };
        next();
    },
}));

// --- in-memory mood store (jest allows `mock`-prefixed vars inside factories) ---
const mockMoodStore = new Map<string, any>();
let mockSeq = 0;

jest.mock(require.resolve("../src/models/mood-log.model"), () => {
    const keyOf = (userId: any, logDate: any) =>
        `${userId}|${logDate instanceof Date ? logDate.toISOString() : logDate}`;
    const makeQuery = (arr: any[]) => {
        const q: any = {
            sort: () => q,
            limit: () => q,
            populate: () => q,
            select: () => q,
            lean: () => Promise.resolve(arr),
            exec: () => Promise.resolve(arr),
            then: (resolve: any, reject: any) => Promise.resolve(arr).then(resolve, reject),
        };
        return q;
    };
    return {
        __esModule: true,
        default: {
            find: (filter: any = {}) => {
                let arr = Array.from(mockMoodStore.values());
                if (filter.userId) arr = arr.filter((d) => String(d.userId) === String(filter.userId));
                if (filter.logDate && typeof filter.logDate === "object") {
                    const { $gte, $lte } = filter.logDate;
                    if ($gte) arr = arr.filter((d) => d.logDate.getTime() >= $gte.getTime());
                    if ($lte) arr = arr.filter((d) => d.logDate.getTime() <= $lte.getTime());
                }
                arr = arr.sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
                return makeQuery(arr);
            },
            deleteOne: async (filter: any = {}) => {
                const existed = mockMoodStore.delete(keyOf(filter.userId, filter.logDate));
                return { acknowledged: true, deletedCount: existed ? 1 : 0 };
            },
            findOneAndUpdate: async (filter: any, update: any) => {
                const k = keyOf(filter.userId, filter.logDate);
                const now = new Date();
                let doc = mockMoodStore.get(k);
                if (!doc) {
                    doc = {
                        _id: `mock_${++mockSeq}`,
                        userId: filter.userId,
                        logDate: filter.logDate,
                        createdAt: now,
                        updatedAt: now,
                    };
                }
                if (update?.$set) Object.assign(doc, update.$set);
                doc.updatedAt = now;
                mockMoodStore.set(k, doc);
                return doc;
            },
        },
    };
});

// --- user model: any id resolves to a user joined 2020-06-01 (backdating floor) ---
jest.mock(require.resolve("../src/models/user.model"), () => ({
    __esModule: true,
    default: {
        findById: () => ({
            select() {
                return this;
            },
            lean: () =>
                Promise.resolve({
                    onboarding_data: { onboarded_at: new Date("2020-06-01T00:00:00Z") },
                    createdAt: new Date("2020-06-01T00:00:00Z"),
                }),
        }),
    },
}));

import request from "supertest";
import app from "../src/app";

const USER = "u_mood_1";
const auth = (r: request.Test) => r.set("x-user", USER);

beforeEach(() => {
    mockMoodStore.clear();
    mockSeq = 0;
});

describe("Mood Log API", () => {
    describe("Auth", () => {
        it("returns 401 when the x-user header is missing", async () => {
            const res = await request(app).get("/api/v1/mood-logs");
            expect(res.status).toBe(401);
        });
    });

    describe("POST /api/v1/mood-logs", () => {
        it("creates a mood log (200) for a valid past date", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 4,
                logDate: "2020-06-15",
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe("Mood log saved successfully");
            expect(res.body.data.mood).toBe(4);
            expect(res.body.data.logDate).toBe("2020-06-15");
        });

        it("updates the same day's log instead of creating a second (upsert)", async () => {
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 2, logDate: "2020-06-20" });
            const update = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 5,
                logDate: "2020-06-20",
            });
            expect(update.status).toBe(200);
            expect(update.body.data.mood).toBe(5);

            const list = await auth(request(app).get("/api/v1/mood-logs"));
            const forDay = list.body.data.filter((l: any) => l.logDate === "2020-06-20");
            expect(forDay).toHaveLength(1);
            expect(forDay[0].mood).toBe(5);
        });

        it("rejects a future date with 400", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 3,
                logDate: "2999-01-01",
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Cannot log a mood for a future date");
        });

        it("rejects a date before the user joined with 400", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 3,
                logDate: "2020-05-01",
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Cannot log a mood for a date before you joined the platform");
        });

        it("rejects an impossible calendar date (passes regex, fails parse) with 400", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 3,
                logDate: "2020-02-30",
            });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe("logDate must be a valid date in YYYY-MM-DD format");
        });

        it("rejects an out-of-range mood via the Joi validator (400)", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 6,
                logDate: "2020-06-15",
            });
            expect(res.status).toBe(400);
        });

        it("rejects a malformed logDate via the Joi validator (400)", async () => {
            const res = await auth(request(app).post("/api/v1/mood-logs")).send({
                mood: 3,
                logDate: "15-06-2020",
            });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/v1/mood-logs", () => {
        it("returns the user's logs newest-first with a totalCount", async () => {
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 2, logDate: "2020-06-10" });
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 4, logDate: "2020-06-12" });

            const res = await auth(request(app).get("/api/v1/mood-logs"));
            expect(res.status).toBe(200);
            expect(res.body.totalCount).toBe(2);
            expect(res.body.data.map((l: any) => l.logDate)).toEqual(["2020-06-12", "2020-06-10"]);
        });

        it("honours the ?from&to calendar range filter", async () => {
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 2, logDate: "2020-06-10" });
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 4, logDate: "2020-06-20" });

            const res = await auth(request(app).get("/api/v1/mood-logs?from=2020-06-15&to=2020-06-25"));
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].logDate).toBe("2020-06-20");
        });
    });

    describe("DELETE /api/v1/mood-logs", () => {
        it("deletes an existing day's log (200)", async () => {
            await auth(request(app).post("/api/v1/mood-logs")).send({ mood: 3, logDate: "2020-06-18" });
            const res = await auth(request(app).delete("/api/v1/mood-logs")).send({ logDate: "2020-06-18" });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Mood log deleted successfully");
        });

        it("returns 404 when there is no log for that day", async () => {
            const res = await auth(request(app).delete("/api/v1/mood-logs")).send({ logDate: "2020-06-19" });
            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Mood log not found");
        });

        it("rejects a malformed logDate via the Joi validator (400)", async () => {
            const res = await auth(request(app).delete("/api/v1/mood-logs")).send({ logDate: "nope" });
            expect(res.status).toBe(400);
        });
    });
});
