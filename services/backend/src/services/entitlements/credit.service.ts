import consultationCreditModel from "../../models/consultation-credit.model";
import {
    ECreditReason,
    ECreditType,
    IConsultationCredit,
    IPlanCredits,
    TObjectIdLike,
} from "../../types/subscription.types";

/** Thrown when a consume is attempted against an insufficient balance. */
export class InsufficientCreditsError extends Error {
    public readonly code = "NO_CREDITS";
    constructor(public readonly type: ECreditType) {
        super(`No ${type} credits remaining`);
    }
}

const MAX_APPEND_ATTEMPTS = 5;

/**
 * The consultation-credit ledger.
 *
 * Append-only: a consume is a new negative row, never an update. Balance is the newest
 * row's `balanceAfter`. This exists as a ledger rather than a counter because bookings
 * get cancelled and marked UNHANDLED, and those credits have to come back auditably.
 *
 * Concurrency is handled without transactions — the deployed Mongo may be a single node,
 * where transactions are unavailable. Instead every append is ONE insert whose `seq` is
 * protected by a unique index, so a race is resolved by the database and the loser
 * retries against the real balance.
 */
export class CreditService {
    /** Newest ledger row for a bucket, or null if the bucket has never been touched. */
    private async getLatest(
        userId: TObjectIdLike,
        type: ECreditType,
    ): Promise<Pick<IConsultationCredit, "seq" | "balanceAfter"> | null> {
        const latest = await consultationCreditModel
            .findOne({ user_id: userId, type })
            .sort({ seq: -1 })
            .select("seq balanceAfter")
            .lean();
        return latest ?? null;
    }

    public async getBalance(userId: TObjectIdLike, type: ECreditType): Promise<number> {
        const latest = await this.getLatest(userId, type);
        return latest?.balanceAfter ?? 0;
    }

    public async getBalances(
        userId: TObjectIdLike,
    ): Promise<{ expert: number; careManager: number }> {
        const [expert, careManager] = await Promise.all([
            this.getBalance(userId, ECreditType.EXPERT),
            this.getBalance(userId, ECreditType.CARE_MANAGER),
        ]);
        return { expert, careManager };
    }

    /**
     * Append one row, retrying if another writer claimed the same `seq` first.
     *
     * `guard` runs against the freshly-read balance on every attempt, so a consume that
     * lost a race re-checks sufficiency rather than blindly reapplying its delta.
     */
    private async append(params: {
        userId: TObjectIdLike;
        subscriptionId: TObjectIdLike;
        type: ECreditType;
        delta: number;
        reason: ECreditReason;
        expiresAt: Date;
        consultationId?: TObjectIdLike | null;
        guard?: (currentBalance: number) => void;
    }): Promise<IConsultationCredit> {
        let lastError: unknown;

        for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
            const latest = await this.getLatest(params.userId, params.type);
            const currentBalance = latest?.balanceAfter ?? 0;
            const nextSeq = (latest?.seq ?? 0) + 1;

            // Re-evaluated on every attempt, not once before the loop.
            params.guard?.(currentBalance);

            try {
                return (await consultationCreditModel.create({
                    user_id: params.userId,
                    subscription_id: params.subscriptionId,
                    type: params.type,
                    seq: nextSeq,
                    delta: params.delta,
                    balanceAfter: currentBalance + params.delta,
                    reason: params.reason,
                    consultation_id: params.consultationId ?? null,
                    expiresAt: params.expiresAt,
                })) as unknown as IConsultationCredit;
            } catch (err: any) {
                // 11000 = duplicate key. Either another writer took this seq (retry), or
                // the per-consultation CONSUME guard fired, meaning this booking already
                // spent a credit — a double-tapped "Book". Rethrow that one: retrying
                // would burn a second credit, which is the exact bug the index prevents.
                if (err?.code !== 11000) throw err;
                if (params.consultationId && params.reason === ECreditReason.CONSUME) throw err;
                lastError = err;
            }
        }

        throw lastError ?? new Error("Failed to append credit ledger row");
    }

    /**
     * Grant a plan's credits at activation. Both buckets are granted in full up front —
     * there is no per-month drip — and expire with the term.
     */
    public async grantForPlan(params: {
        userId: TObjectIdLike;
        subscriptionId: TObjectIdLike;
        credits: IPlanCredits;
        expiresAt: Date;
    }): Promise<void> {
        const buckets: Array<[ECreditType, number]> = [
            [ECreditType.EXPERT, params.credits.expert],
            [ECreditType.CARE_MANAGER, params.credits.careManager],
        ];

        for (const [type, amount] of buckets) {
            // A plan may legitimately grant zero of a bucket; an empty row would just be
            // noise in the ledger.
            if (amount <= 0) continue;

            await this.append({
                userId: params.userId,
                subscriptionId: params.subscriptionId,
                type,
                delta: amount,
                reason: ECreditReason.GRANT,
                expiresAt: params.expiresAt,
            });
        }
    }

    /**
     * Spend one credit. Throws InsufficientCreditsError rather than going negative.
     *
     * `consultationId` is required: it backs the unique CONSUME index, which is what
     * makes a double-tapped "Book" spend one credit instead of two.
     */
    public async consume(params: {
        userId: TObjectIdLike;
        subscriptionId: TObjectIdLike;
        type: ECreditType;
        consultationId: TObjectIdLike;
        expiresAt: Date;
    }): Promise<IConsultationCredit> {
        return this.append({
            userId: params.userId,
            subscriptionId: params.subscriptionId,
            type: params.type,
            delta: -1,
            reason: ECreditReason.CONSUME,
            consultationId: params.consultationId,
            expiresAt: params.expiresAt,
            guard: (balance) => {
                if (balance < 1) throw new InsufficientCreditsError(params.type);
            },
        });
    }

    /** Return a credit when a consultation ends up UNHANDLED. */
    public async refund(params: {
        userId: TObjectIdLike;
        subscriptionId: TObjectIdLike;
        type: ECreditType;
        consultationId: TObjectIdLike;
        expiresAt: Date;
    }): Promise<IConsultationCredit> {
        return this.append({
            userId: params.userId,
            subscriptionId: params.subscriptionId,
            type: params.type,
            delta: 1,
            reason: ECreditReason.REFUND,
            consultationId: params.consultationId,
            expiresAt: params.expiresAt,
        });
    }

    /** Zero out a bucket whose term has ended, leaving an auditable EXPIRE row. */
    public async expireBucket(params: {
        userId: TObjectIdLike;
        subscriptionId: TObjectIdLike;
        type: ECreditType;
        expiresAt: Date;
    }): Promise<IConsultationCredit | null> {
        const balance = await this.getBalance(params.userId, params.type);
        if (balance <= 0) return null;

        return this.append({
            userId: params.userId,
            subscriptionId: params.subscriptionId,
            type: params.type,
            delta: -balance,
            reason: ECreditReason.EXPIRE,
            expiresAt: params.expiresAt,
        });
    }
}

export const creditService = new CreditService();
