/**
 * A tiny registry of async cleanup hooks run on SIGTERM/SIGINT.
 *
 * This exists to break an ordering problem. `src/telemetry.ts` initialises the
 * OpenTelemetry SDK as an *import side effect*, because it has to patch `pino`, `http` and
 * `express` before those modules are first required — which means importing it is never
 * free. But the shutdown handlers live in `utils/logger/pino.config.ts`, which is loaded
 * by every entry point including the ts-node scripts that deliberately have no telemetry.
 * Importing telemetry from there just to reach `sdk.shutdown()` would boot the whole SDK
 * in those processes.
 *
 * So the dependency is inverted: telemetry registers a hook here if and only if it
 * actually started, and the logger's signal handler drains this registry knowing nothing
 * about what is in it. Neither module imports the other.
 *
 * Hooks are best effort. A hook that throws or hangs must not stop the others from
 * running or keep the process alive past its shutdown grace period.
 */
export type ShutdownHook = {
    name: string;
    run: () => Promise<void>;
};

const hooks: ShutdownHook[] = [];

export function registerShutdownHook(hook: ShutdownHook): void {
    hooks.push(hook);
}

/**
 * Runs every registered hook, bounded by `timeoutMs` in total.
 *
 * The cap matters on Cloud Run: SIGTERM is followed by roughly 10 seconds before the
 * container is killed outright, and an unbounded flush against an unreachable collector
 * would burn all of it and lose the buffered records anyway.
 *
 * Never rejects — the caller is a signal handler on its way to process.exit().
 */
export async function runShutdownHooks(timeoutMs = 5000): Promise<void> {
    if (hooks.length === 0) return;

    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        // Do not let the timeout itself hold the event loop open if every hook finishes early.
        timer.unref?.();
    });

    const all = Promise.all(
        hooks.map(async (hook) => {
            try {
                await hook.run();
            } catch {
                // Swallowed deliberately: we are already shutting down, the app logger may
                // itself be mid-flush, and one failing hook must not block the rest.
            }
        }),
    ).then(() => undefined);

    try {
        await Promise.race([all, deadline]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Test seam — the registry is module-level state that would otherwise leak across suites. */
export function clearShutdownHooks(): void {
    hooks.length = 0;
}
