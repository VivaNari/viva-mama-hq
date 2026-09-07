import subscriptionModel from "../../models/subscription.model";
import webhookEventModel from "../../models/webhook-event.model";
import {
    EBillingMode,
    EBillingProvider,
    ESubscriptionStatus,
    ISubscription,
} from "../../types/subscription.types";
import logger, { createModuleLogger } from "../../utils/logger";
import {
    EPlaySubscriptionState,
    getBillingProvider,
    GooglePlayProvider,
    IPlaySubscriptionPurchase,
    PLAY_ENTITLED_STATES,
} from "./billing";
import { subscriptionService } from "./subscription.service";

const log = createModuleLogger(logger, "play-rtdn.service");

/**
 * Real-Time Developer Notifications from Google Play.
 *
 * Without this, a Play subscription is bought once and never changes: renewals never
 * extend access, cancellations never register, and a refund never revokes anything. The
 * purchase path alone is not a billing integration.
 *
 * Two rules shape everything below.
 *
 * **The notification is a signal, not a description.** Every handler re-reads the real
 * state with `subscriptionsv2.get` rather than trusting the message body. Notifications
 * arrive out of order and can be redelivered minutes later, so a body that says
 * "renewed" may already be stale. Re-reading makes ordering irrelevant.
 *
 * **Always answer 200.** Pub/Sub retries any non-2xx until its retention expires, so a
 * notification this code cannot handle would be redelivered for days. Unknown types are
 * recorded and acknowledged.
 */

/** DeveloperNotification.subscriptionNotification.notificationType. */
export enum EPlayNotificationType {
    RECOVERED = 1,
    RENEWED = 2,
    CANCELED = 3,
    PURCHASED = 4,
    ON_HOLD = 5,
    IN_GRACE_PERIOD = 6,
    RESTARTED = 7,
    PRICE_CHANGE_CONFIRMED = 8,
    DEFERRED = 9,
    PAUSED = 10,
    PAUSE_SCHEDULE_CHANGED = 11,
    REVOKED = 12,
    EXPIRED = 13,
    PENDING_PURCHASE_CANCELED = 20,
}

export interface IDeveloperNotification {
    version?: string;
    packageName?: string;
    eventTimeMillis?: string;
    subscriptionNotification?: {
        version?: string;
        notificationType: number;
        purchaseToken: string;
        subscriptionId: string;
    };
    voidedPurchaseNotification?: {
        purchaseToken: string;
        orderId?: string;
        productType?: number;
    };
    testNotification?: { version?: string };
}

export type RtdnOutcome =
    | "PROCESSED"
    | "DUPLICATE"
    | "MALFORMED"
    | "TEST"
    | "IGNORED"
    | "UNKNOWN_SUBSCRIPTION";

export class PlayRtdnService {
    private get provider(): GooglePlayProvider {
        return getBillingProvider(EBillingMode.PLAY) as GooglePlayProvider;
    }

    /**
     * Decode a Pub/Sub push envelope into a DeveloperNotification.
     *
     * Returns null rather than throwing on anything malformed: a body this code cannot
     * parse will not become parseable on retry, so it must be acknowledged, not retried.
     */
    public decode(body: {
        message?: { data?: string; messageId?: string; message_id?: string };
    }): { notification: IDeveloperNotification; messageId: string } | null {
        const data = body?.message?.data;
        // Pub/Sub sends camelCase over HTTP push and snake_case in some client
        // libraries. Accepting both costs nothing and avoids a silent idempotency hole.
        const messageId = body?.message?.messageId ?? body?.message?.message_id;
        if (!data || !messageId) return null;

        try {
            const json = Buffer.from(data, "base64").toString("utf8");
            return { notification: JSON.parse(json), messageId };
        } catch (error) {
            log.warn({ err: error }, "Play RTDN: undecodable message payload");
            return null;
        }
    }

    /**
     * Record and dispatch one notification.
     *
     * Idempotency is on the Pub/Sub `messageId`, not on anything inside the payload:
     * Google redelivers the same message id, and two genuinely distinct notifications
     * can otherwise look identical (a renewal and its retry carry the same token,
     * product and type).
     */
    public async handle(body: {
        message?: { data?: string; messageId?: string; message_id?: string };
    }): Promise<{ outcome: RtdnOutcome }> {
        const decoded = this.decode(body);
        if (!decoded) return { outcome: "MALFORMED" };

        const { notification, messageId } = decoded;

        // Play Console's "send test notification" button. Acknowledged so the Console
        // reports success, but nothing is looked up — there is no purchase behind it.
        if (notification.testNotification) {
            log.info("Play RTDN: test notification received");
            return { outcome: "TEST" };
        }

        try {
            await webhookEventModel.create({
                providerEventId: `play:${messageId}`,
                provider: EBillingProvider.GOOGLE_PLAY,
                type: String(
                    notification.subscriptionNotification?.notificationType ??
                        (notification.voidedPurchaseNotification ? "VOIDED" : "UNKNOWN"),
                ),
                payload: notification as unknown as Record<string, unknown>,
                processedAt: null,
            });
        } catch (error: any) {
            if (error?.code === 11000) return { outcome: "DUPLICATE" };
            throw error;
        }

        try {
            const outcome = await this.dispatch(notification);
            await webhookEventModel.updateOne(
                { providerEventId: `play:${messageId}` },
                { $set: { processedAt: new Date() } },
            );
            return { outcome };
        } catch (error: any) {
            // Left unprocessed with the error recorded, so a crash mid-handling stays
            // visible rather than being silently swallowed.
            await webhookEventModel.updateOne(
                { providerEventId: `play:${messageId}` },
                { $set: { error: error?.message ?? String(error) } },
            );
            throw error;
        }
    }

    private async dispatch(notification: IDeveloperNotification): Promise<RtdnOutcome> {
        // A refund or chargeback. Revokes access immediately regardless of dates — the
        // money has gone back, so the entitlement goes with it.
        if (notification.voidedPurchaseNotification) {
            return this.onVoided(notification.voidedPurchaseNotification.purchaseToken);
        }

        const sub = notification.subscriptionNotification;
        if (!sub?.purchaseToken) return "MALFORMED";

        const row = await this.findByToken(sub.purchaseToken);

        // A notification for a purchase this system has no row for. The usual cause is a
        // purchase whose client-side verification never completed — so activate it here
        // rather than dropping it, which is the difference between a user who paid and
        // got access and one who paid and did not.
        if (!row) {
            return this.onUnknownPurchase(sub.purchaseToken, sub.notificationType);
        }

        const purchase = await this.provider.getSubscription(sub.purchaseToken);

        switch (sub.notificationType) {
            case EPlayNotificationType.RENEWED:
            case EPlayNotificationType.RECOVERED:
            case EPlayNotificationType.RESTARTED:
                await this.onRenewed(row, purchase);
                return "PROCESSED";

            case EPlayNotificationType.CANCELED:
                await this.onCancelled(row, purchase);
                return "PROCESSED";

            case EPlayNotificationType.IN_GRACE_PERIOD:
                // Payment failed and Google is retrying. Access continues, so this is a
                // status change only — the dates must not move.
                await this.setStatus(row, ESubscriptionStatus.HALTED);
                return "PROCESSED";

            case EPlayNotificationType.ON_HOLD:
            case EPlayNotificationType.PAUSED:
                await this.onHeld(row, purchase);
                return "PROCESSED";

            case EPlayNotificationType.EXPIRED:
                // Guarded, unlike REVOKED below. Notifications arrive out of order and
                // are redelivered minutes later, and a renewal lands as two separate
                // messages -- the old term ending and the new one beginning. Observed in
                // testing: EXPIRED arrived six seconds BEFORE the RENEWED that revived
                // the row. Reversed, an unguarded expire would revoke a live, paid
                // subscription and nothing would put it back until the next renewal.
                //
                // `purchase` was just re-read from Google a few lines above, which is
                // this file's whole doctrine: the notification is a signal, the API is
                // the truth. If Google still reports an entitled state, this message
                // describes a period that has already been superseded.
                if (this.isEntitled(purchase)) {
                    log.info(
                        {
                            subscriptionId: String(row._id),
                            subscriptionState: purchase.subscriptionState,
                        },
                        "Play RTDN: stale EXPIRED for a purchase Google still reports as entitled; ignoring",
                    );
                    return "IGNORED";
                }
                await subscriptionService.expire(row);
                return "PROCESSED";

            case EPlayNotificationType.REVOKED:
                // Deliberately unguarded. A revocation is Google taking the entitlement
                // back -- refund, chargeback, or developer action -- and is authoritative
                // whatever the state field happens to read at this instant. Treating it
                // like EXPIRED would let a refunded user keep access.
                await subscriptionService.expire(row);
                return "PROCESSED";

            case EPlayNotificationType.PURCHASED:
                // Already have a row for this token, so the client's verify call won.
                // Nothing to do; re-reading confirmed the state either way.
                return "PROCESSED";

            default:
                // Price changes, deferrals and pause-schedule changes carry no
                // entitlement consequence for this app. Recorded, acknowledged, ignored.
                log.info(
                    { notificationType: sub.notificationType },
                    "Play RTDN: no handler for notification type",
                );
                return "IGNORED";
        }
    }

    private async findByToken(purchaseToken: string): Promise<ISubscription | null> {
        return (await subscriptionModel
            .findOne({ playPurchaseToken: purchaseToken })
            .lean()) as ISubscription | null;
    }

    /**
     * A purchase Google knows about and this system does not.
     *
     * Only worth acting on while the purchase is still live; a notification about a
     * purchase that has since expired has nothing to grant.
     */
    private async onUnknownPurchase(
        purchaseToken: string,
        notificationType: number,
    ): Promise<RtdnOutcome> {
        if (
            notificationType !== EPlayNotificationType.PURCHASED &&
            notificationType !== EPlayNotificationType.RENEWED
        ) {
            log.warn(
                { notificationType },
                "Play RTDN: notification for a purchase token with no subscription row",
            );
            return "UNKNOWN_SUBSCRIPTION";
        }

        const purchase = await this.provider.getSubscription(purchaseToken);
        const accountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;

        // Without the account id there is no way to know whose purchase this is. Logged
        // loudly: it means a purchase was made without the app attaching an account id,
        // which should be impossible on the current client.
        if (!accountId) {
            log.error(
                { productId: purchase.lineItems?.[0]?.productId },
                "Play RTDN: unattributable purchase — no obfuscatedExternalAccountId",
            );
            return "UNKNOWN_SUBSCRIPTION";
        }

        // A plan change issues a NEW purchase token and points it at the one it replaced.
        // That predecessor is the only thread back to a user id: the obfuscated account
        // id above is an HMAC and cannot be reversed, so without this a user who changed
        // plan and whose client-side verify never completed pays and gets nothing, with
        // no way for this system to work out who they are.
        //
        // The token only nominates a candidate. activateFromPlayPurchase re-reads the
        // purchase from Google and checks its obfuscatedExternalAccountId against the
        // HMAC of this user id, so a forged or mismatched link is rejected there — this
        // is a recovery path, not a way around the account binding.
        const linked = purchase.linkedPurchaseToken;
        if (linked) {
            const predecessor = await this.findByToken(linked);
            if (predecessor) {
                log.info(
                    {
                        userId: String(predecessor.user_id),
                        previousSubscriptionId: String(predecessor._id),
                    },
                    "Play RTDN: attributing an unreported purchase via its linked predecessor",
                );

                const productId = purchase.lineItems?.[0]?.productId;
                if (productId) {
                    await subscriptionService.activateFromPlayPurchase(predecessor.user_id, {
                        purchaseToken,
                        productId,
                    });
                    return "PROCESSED";
                }
            }
        }

        log.warn(
            { accountId },
            "Play RTDN: live purchase with no local row; client verification likely never completed",
        );
        return "UNKNOWN_SUBSCRIPTION";
    }

    /** Extend the term and grant the next period's credits. */
    private async onRenewed(
        row: ISubscription,
        purchase: IPlaySubscriptionPurchase,
    ): Promise<void> {
        const expiry = purchase.lineItems?.[0]?.expiryTime;
        if (!expiry) return;

        const currentPeriodEnd = new Date(expiry);

        // Guard against redelivery and out-of-order arrival: an older notification must
        // never shorten a term that a newer one already extended.
        if (row.currentPeriodEnd && currentPeriodEnd <= row.currentPeriodEnd) {
            log.info(
                { subscriptionId: String(row._id) },
                "Play RTDN: renewal is not newer than the stored period; ignoring",
            );
            return;
        }

        await subscriptionModel.updateOne(
            { _id: row._id },
            {
                $set: {
                    status: ESubscriptionStatus.ACTIVE,
                    currentPeriodStart: row.currentPeriodEnd ?? new Date(),
                    currentPeriodEnd,
                    cancelledAt: null,
                    isCurrent: true,
                },
            },
        );

        // Before the credits, deliberately: `resolveTier` reads the snapshot, so this is
        // what actually extends the user's access. A credit grant that throws must not
        // leave a paid, renewed subscriber locked out.
        await subscriptionService.refreshSnapshot(row.user_id);

        await subscriptionService.grantRenewalCredits(row, currentPeriodEnd);
    }

    /**
     * Auto-renew turned off. Access runs to the date already paid for, so nothing but
     * the status changes — `LIVE_STATUSES` already treats CANCELLED as governing.
     */
    private async onCancelled(
        row: ISubscription,
        purchase: IPlaySubscriptionPurchase,
    ): Promise<void> {
        const expiry = purchase.lineItems?.[0]?.expiryTime;

        await subscriptionModel.updateOne(
            { _id: row._id },
            {
                $set: {
                    status: ESubscriptionStatus.CANCELLED,
                    cancelledAt: new Date(),
                    // Trust Google's expiry over ours: cancelling during a grace period
                    // can move it.
                    ...(expiry ? { currentPeriodEnd: new Date(expiry) } : {}),
                },
            },
        );

        await subscriptionService.refreshSnapshot(row.user_id);
    }

    /**
     * Retries exhausted, or the user paused. Access has stopped but the subscription can
     * still recover, so the row stays live and HALTED rather than being expired — an
     * expired row would lose the credits a RECOVERED notification should restore.
     */
    private async onHeld(row: ISubscription, purchase: IPlaySubscriptionPurchase): Promise<void> {
        const expiry = purchase.lineItems?.[0]?.expiryTime;
        await subscriptionModel.updateOne(
            { _id: row._id },
            {
                $set: {
                    status: ESubscriptionStatus.HALTED,
                    ...(expiry ? { currentPeriodEnd: new Date(expiry) } : {}),
                },
            },
        );

        await subscriptionService.refreshSnapshot(row.user_id);
    }

    private async setStatus(row: ISubscription, status: ESubscriptionStatus): Promise<void> {
        await subscriptionModel.updateOne({ _id: row._id }, { $set: { status } });
        await subscriptionService.refreshSnapshot(row.user_id);
    }

    /** Refund or chargeback: revoke now, regardless of the period end. */
    private async onVoided(purchaseToken: string): Promise<RtdnOutcome> {
        const row = await this.findByToken(purchaseToken);
        if (!row) return "UNKNOWN_SUBSCRIPTION";

        await subscriptionService.expire(row);
        log.warn(
            { subscriptionId: String(row._id) },
            "Play RTDN: purchase voided; access revoked immediately",
        );
        return "PROCESSED";
    }

    /** Exposed for the state check in tests and for future reconciliation work. */
    public isEntitled(purchase: IPlaySubscriptionPurchase): boolean {
        return PLAY_ENTITLED_STATES.includes(purchase.subscriptionState as EPlaySubscriptionState);
    }
}

export const playRtdnService = new PlayRtdnService();
