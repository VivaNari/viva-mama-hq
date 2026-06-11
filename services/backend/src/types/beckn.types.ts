// Beckn protocol types.
//
// Field naming is camelCase to match the ONIX adapter (Beckn v2) that fronts this
// backend — requests arrive as POST /api/v1/beckn/<action> with { context, message }.
// Kept intentionally loose: the `message` body varies widely across ONHS use cases,
// so each handler reads only what it needs and `unknown` keys are preserved.

export type BecknAckStatus = "ACK" | "NACK";

export interface BecknContext {
    networkId?: string;
    action: string;
    version?: string;
    bapId?: string;
    bapUri?: string;
    bppId?: string;
    bppUri?: string;
    transactionId?: string;
    messageId?: string;
    timestamp?: string;
    [key: string]: unknown;
}

export interface BecknRequest<TMessage = Record<string, unknown>> {
    context: BecknContext;
    message: TMessage;
}

export interface BecknError {
    code?: string;
    message?: string;
    paths?: string;
}

export interface BecknAck {
    message: { ack: { status: BecknAckStatus } };
    error?: BecknError;
}
