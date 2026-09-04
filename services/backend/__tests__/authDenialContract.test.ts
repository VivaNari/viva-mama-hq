/**
 * The contract that decides whether a refused request costs the user their session.
 *
 * The app cannot tell "your token is dead" from "you may not do that" by status code
 * alone — both are 403 — so it reads a `code` off the body, and treats a 403 without a
 * recognisable one as an expired session. That default is deliberate (it keeps an app
 * correct against a server that predates the codes), but it means **an authorization
 * refusal that forgets its code silently logs the user out**.
 *
 * That is not a theoretical failure. It shipped: a new member who had not yet accepted
 * the community guidelines was signed out of the entire product for trying to leave a
 * comment, and the client's own recovery path never ran because the session was gone
 * before the screen's catch block was reached.
 *
 * These tests pin both halves — the auth codes the middleware sends, and the fact that
 * business refusals send something else.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

// `env` reads process.env once at import, and JWT_SECRET is unset under test — which
// would make even a well-formed token fail to verify and turn the happy-path case into
// a false pass.
jest.mock(require.resolve("../src/config/env"), () => ({
    __esModule: true,
    default: { JWT_SECRET: "test-secret-for-auth-denial-contract" },
}));

import jwt from "jsonwebtoken";

import env from "../src/config/env";
import authMiddleware from "../src/middlewares/authorization.middleware";
import { EAuthDenial, isAuthDenialCode } from "../src/types/auth.types";
import { EPostingDenial } from "../src/services/vivaClub/posting-gate";

/** Captures whatever sendResponse writes. */
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

const runAuth = async (headers: Record<string, string>) => {
    const { res, captured } = fakeRes();
    const next = jest.fn();
    await authMiddleware("header")({ headers, query: {} } as any, res, next);
    // jwt.verify's callback runs synchronously here, but yield anyway rather than
    // depend on that.
    await new Promise((r) => setImmediate(r));
    return { captured, next };
};

describe("authentication denials carry a code the app can act on", () => {
    it("tags a missing token", async () => {
        const { captured, next } = await runAuth({});

        expect(captured.statusCode).toBe(401);
        expect(captured.body.data.code).toBe(EAuthDenial.TOKEN_MISSING);
        expect(next).not.toHaveBeenCalled();
    });

    it("tags an invalid token", async () => {
        const { captured, next } = await runAuth({ authorization: "Bearer not-a-real-token" });

        // 403, and the code is what tells the app this one really is a dead session.
        expect(captured.statusCode).toBe(403);
        expect(captured.body.data.code).toBe(EAuthDenial.TOKEN_INVALID);
        expect(next).not.toHaveBeenCalled();
    });

    it("lets a valid token through untouched", async () => {
        const token = jwt.sign({ _id: "6a796328fe07d8ea46a5b941" }, env.JWT_SECRET as string);

        const { captured, next } = await runAuth({ authorization: `Bearer ${token}` });

        expect(next).toHaveBeenCalled();
        expect(captured.statusCode).toBeUndefined();
    });
});

describe("authorization denials are distinguishable from them", () => {
    it("classifies auth codes as session-ending and nothing else", () => {
        expect(isAuthDenialCode(EAuthDenial.TOKEN_MISSING)).toBe(true);
        expect(isAuthDenialCode(EAuthDenial.TOKEN_INVALID)).toBe(true);

        // The refusals that caused the original bug. If any of these ever satisfied
        // isAuthDenialCode, the app would log the user out for hitting a product rule.
        expect(isAuthDenialCode(EPostingDenial.GUIDELINES_NOT_ACCEPTED)).toBe(false);
        expect(isAuthDenialCode(EPostingDenial.COMMUNITY_BANNED)).toBe(false);
        expect(isAuthDenialCode("FORBIDDEN")).toBe(false);
    });

    it("treats an absent code as session-ending, which is the safe default", () => {
        // An app running against a server that predates these codes must still sign out
        // on a genuinely expired token. Stranding someone in a session where every
        // request fails, with nothing offering the login screen, is the worse failure.
        expect(isAuthDenialCode(undefined)).toBe(false);
        expect(isAuthDenialCode(null)).toBe(false);
    });
});
