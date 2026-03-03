import { AsyncLocalStorage } from "async_hooks";

export interface AsyncContext {
    correlationId?: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    [key: string]: any;
}

const asyncLocalStorage = new AsyncLocalStorage<AsyncContext>();

export function runWithContext<T>(context: AsyncContext, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
}

export function getAsyncContext(): AsyncContext | undefined {
    return asyncLocalStorage.getStore();
}

export function setContextValue(key: string, value: any): void {
    const store = asyncLocalStorage.getStore();
    if (store) {
        store[key] = value;
    }
}

export function getContextValue<T>(key: string): T | undefined {
    const store = asyncLocalStorage.getStore();
    return store?.[key] as T | undefined;
}

export function getCorrelationId(): string | undefined {
    return getContextValue<string>("correlationId");
}

export function getRequestId(): string | undefined {
    return getContextValue<string>("requestId");
}

export function getUserId(): string | undefined {
    return getContextValue<string>("userId");
}

export function updateContext(updates: Partial<AsyncContext>): void {
    const store = asyncLocalStorage.getStore();
    if (store) {
        Object.assign(store, updates);
    }
}

export default asyncLocalStorage;
