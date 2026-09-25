/**
 * Bridge between the non-React axios interceptor and the React AuthContext.
 *
 * The axios instance is a module-level singleton and cannot use hooks, so it
 * cannot call `signOut()` directly. AuthContext registers a handler here on
 * mount; the interceptor triggers it when the backend returns 401.
 */
type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null) => {
  handler = fn;
};

export const triggerUnauthorized = () => {
  handler?.();
};
