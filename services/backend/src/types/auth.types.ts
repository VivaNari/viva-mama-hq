/**
 * Why a request was refused, as a machine-readable code on the response body.
 *
 * The app cannot tell these apart from the status code alone, and the difference
 * decides whether the user keeps their session:
 *
 *  - **Authentication** failed — we do not know who you are. The token is missing,
 *    expired or forged. Signing the user out is the correct response.
 *  - **Authorization** failed — we know exactly who you are, and the answer is no.
 *    The session is perfectly good. Signing the user out over this is a bug, and a
 *    loud one: it drops a valid session and sends the user back to the login screen
 *    for having pressed a button they were not allowed to press.
 *
 * Both are 403 by the letter of HTTP, which is why the code exists. Every 403 the
 * mobile client can reach **must** carry one of these, or the client falls back to
 * treating it as an expired session — see the response interceptor in
 * `apiClientInterceptor.ts`.
 */
export enum EAuthDenial {
    TOKEN_MISSING = "TOKEN_MISSING",
    TOKEN_INVALID = "TOKEN_INVALID",
}

/**
 * Refusals of an authenticated, known user. These must never log anyone out.
 *
 * Not an exhaustive registry — feature modules own their own codes (`EPostingDenial`
 * in the Viva Club posting gate, for instance). The contract the client relies on is
 * only this: **a 403 carrying any code that is not an `EAuthDenial` is an
 * authorization refusal and leaves the session alone.**
 */
export enum EAccessDenial {
    DELIVERY_DATE_LOCKED = "DELIVERY_DATE_LOCKED",
    /** A message id that is not the caller's. Answered as 404, never 403 — see below. */
    MESSAGE_NOT_YOURS = "MESSAGE_NOT_YOURS",
}

/** True when a denial code means the caller's identity itself is not established. */
export const isAuthDenialCode = (code: unknown): boolean =>
    typeof code === "string" && Object.values(EAuthDenial).includes(code as EAuthDenial);
