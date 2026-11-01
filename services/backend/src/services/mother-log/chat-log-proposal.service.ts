import { Types } from "mongoose";

import { chatLogProposalValidator } from "../../api/v1/validators/mother-log/mother-log.validator";
import messageModel from "../../models/message.model";
import { IPendingLog, MessageRoleEnum } from "../../types/chat.types";
import { APPEND_LOG_TYPES, TAppendLogType, TDailyLogType } from "../../types/mother-log.types";
import { getISTCalendarDate } from "../date/date.service";
import ReminderService from "../reminders/reminder.service";
import MotherLogService from "./mother-log.service";

/** More than this in one message is not a mother logging her day. */
const MAX_PROPOSALS_PER_MESSAGE = 10;

const DAILY_FIELD: Record<TDailyLogType, "glasses" | "count"> = { water: "glasses", kicks: "count" };
const DAILY_MAX: Record<TDailyLogType, number> = { water: 30, kicks: 200 };

export type TConfirmOutcome =
    | { result: "ok"; item: IPendingLog }
    | { result: "not_found" }
    | { result: "day_closed" }
    | { result: "medicine_missing" }
    | { result: "reminder_limit" }
    | { result: "reminder_in_past" };

// A bare yes or no, as a whole message, in English, Hinglish or Hindi.
const YES_REPLY =
    /^\s*(yes|yeah|yep|yup|y|ok|okay|sure|save|save it|please save|haan|han|haa|ha|ji|ji haan|haan ji|theek hai|thik hai|kar do|save kar do|हाँ|हां|जी|जी हाँ|ठीक है|सेव कर दो)[\s.!]*$/i;
const NO_REPLY =
    /^\s*(no|nope|nah|n|cancel|don'?t|do not save|nahi|nahin|na|mat karo|rehne do|नहीं|ना|रहने दो)[\s.!]*$/i;

/** "yes" / "no" if the whole message is a plain confirmation, else null. */
export const parseConfirmReply = (text: string): "yes" | "no" | null => {
    if (YES_REPLY.test(text)) return "yes";
    if (NO_REPLY.test(text)) return "no";
    return null;
};

const isDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

/**
 * The short reply when she answers a confirm card by typing instead of tapping.
 * `reminder` is true when what she answered was a reminder rather than a log.
 */
export const confirmationReply = (
    text: string,
    saved: number,
    dismissed: number,
    reminder = false,
): string => {
    const hindi = isDevanagari(text);
    if (reminder) {
        if (saved > 0) {
            return hindi
                ? "रिमाइंडर सेट हो गया ✓ आप इसे Reminders में देख सकती हैं।"
                : "Reminder set ✓ You can see it under Reminders.";
        }
        if (dismissed > 0) {
            return hindi ? "ठीक है, मैंने रिमाइंडर सेट नहीं किया।" : "Okay, I haven't set the reminder.";
        }
        return hindi
            ? "रिमाइंडर सेट नहीं हो सका। कृपया Reminders से जोड़ें।"
            : "I couldn't set that reminder. Please add it from Reminders.";
    }
    if (saved > 0) {
        return hindi
            ? "सहेज दिया ✓ आप इसे Log something में देख सकती हैं।"
            : "Saved ✓ You can see it under Log something.";
    }
    if (dismissed > 0) {
        return hindi ? "ठीक है, मैंने इसे नहीं सहेजा।" : "Okay, I haven't saved it.";
    }
    return hindi
        ? "इसे सहेजा नहीं जा सका। कृपया Log something से जोड़ें।"
        : "I couldn't save that. Please add it from Log something.";
};

/**
 * Logging from chat. The chatbot proposes, this service validates, and nothing is
 * written until she confirms (PRD 4.2: "after a one-tap confirm").
 *
 * The confirm card lives on the assistant message (`pendingLogs`), so it survives an
 * app restart and the record shows what she agreed to.
 */
class ChatLogProposalService {
    private logs = new MotherLogService();
    private reminders = new ReminderService();

    /**
     * Validate what the chatbot proposed and turn it into pending card items. Anything
     * that fails validation is dropped: a malformed proposal is a chatbot bug, not
     * something to ask her about.
     */
    prepare = async (userId: string, raw: unknown): Promise<IPendingLog[]> => {
        if (!Array.isArray(raw) || raw.length === 0) return [];

        const items: IPendingLog[] = [];
        for (const proposal of raw.slice(0, MAX_PROPOSALS_PER_MESSAGE)) {
            const { error, value } = chatLogProposalValidator.validate(proposal);
            if (error) {
                console.warn(`Dropping chat log proposal for user ${userId}: ${error.message}`);
                continue;
            }

            let medicineId: string | null = null;
            let medicineRef: { presetKey?: string; name?: string } | null = null;
            let status: IPendingLog["status"] = "pending";

            if (value.logType === "medicine_dose") {
                const match = await this.logs.matchMedicine(userId, value.medicineRef);
                if (match) {
                    medicineId = String(match._id);
                    // Named as it is on her list, which is what the card shows.
                    medicineRef = match.presetKey ? { presetKey: match.presetKey } : { name: match.name ?? "" };
                } else {
                    medicineRef = value.medicineRef;
                    status = "needs_medicine";
                }
            }

            items.push({
                _id: new Types.ObjectId() as unknown as IPendingLog["_id"],
                logType: value.logType,
                fields: value.fields,
                mode: value.mode ?? null,
                medicineId,
                medicineRef,
                status,
                savedLogId: null,
            });
        }
        return items;
    };

    /**
     * Her Yes or No on one card item.
     *
     * The item is claimed atomically (pending → saved/dismissed) before anything is
     * written, so a double tap or a tap racing a typed "yes" writes once. A second
     * answer returns the item as it already stands.
     */
    confirm = async ({
        userId,
        messageId,
        proposalId,
        accept,
    }: {
        userId: string;
        messageId: string;
        proposalId: string;
        accept: boolean;
    }): Promise<TConfirmOutcome> => {
        const message = await messageModel.findOne({ _id: messageId, userId }).lean();
        const item = message?.pendingLogs?.find((p) => String(p._id) === proposalId);
        if (!message || !item) return { result: "not_found" };
        if (item.status !== "pending") return { result: "ok", item };

        // A card from an earlier day would file yesterday's reading under today.
        if (accept && getISTCalendarDate(message.createdAt).getTime() !== getISTCalendarDate().getTime()) {
            return { result: "day_closed" };
        }

        const claimed = await messageModel.findOneAndUpdate(
            {
                _id: messageId,
                userId,
                pendingLogs: { $elemMatch: { _id: new Types.ObjectId(proposalId), status: "pending" } },
            },
            { $set: { "pendingLogs.$.status": accept ? "saved" : "dismissed" } },
            { new: true },
        ).lean();
        const claimedItem = claimed?.pendingLogs?.find((p) => String(p._id) === proposalId);
        if (!claimed || !claimedItem) {
            // Someone else answered it first; report what it is now.
            const current = await messageModel.findOne({ _id: messageId, userId }).lean();
            const now = current?.pendingLogs?.find((p) => String(p._id) === proposalId);
            return now ? { result: "ok", item: now } : { result: "not_found" };
        }

        if (!accept) return { result: "ok", item: claimedItem };

        try {
            const savedLogId = await this.write(userId, item);
            if (savedLogId === "medicine_missing") {
                await this.setStatus(messageId, proposalId, "needs_medicine");
                return { result: "medicine_missing" };
            }
            if (savedLogId === "reminder_limit") {
                // Back to pending: once she removes a reminder, the card works again.
                await this.setStatus(messageId, proposalId, "pending");
                return { result: "reminder_limit" };
            }
            if (savedLogId === "reminder_in_past") {
                await this.setStatus(messageId, proposalId, "dismissed");
                return { result: "reminder_in_past" };
            }
            const updated = await messageModel.findOneAndUpdate(
                { _id: messageId, "pendingLogs._id": new Types.ObjectId(proposalId) },
                { $set: { "pendingLogs.$.savedLogId": savedLogId } },
                { new: true },
            ).lean();
            const saved = updated?.pendingLogs?.find((p) => String(p._id) === proposalId);
            return { result: "ok", item: saved ?? claimedItem };
        } catch (err) {
            // Put the card back so she can try again rather than seeing "saved".
            await this.setStatus(messageId, proposalId, "pending");
            throw err;
        }
    };

    /**
     * A typed "yes" / "no" answers the card on her latest assistant message, if it has
     * pending items. Returns null when there was nothing waiting, so the message goes
     * to the chatbot as usual.
     */
    answerLatest = async (
        userId: string,
        conversationId: string,
        accept: boolean,
    ): Promise<{
        messageId: string;
        saved: number;
        dismissed: number;
        /** Every item answered was a reminder, so the reply talks about reminders. */
        reminder: boolean;
        pendingLogs: IPendingLog[];
    } | null> => {
        const latest = await messageModel
            .findOne({ userId, conversationId, role: MessageRoleEnum.ASSITANT })
            .sort({ createdAt: -1 })
            .lean();
        const waiting = latest?.pendingLogs?.filter((p) => p.status === "pending") ?? [];
        if (!latest || waiting.length === 0) return null;

        let saved = 0;
        let dismissed = 0;
        for (const item of waiting) {
            const outcome = await this.confirm({
                userId,
                messageId: String(latest._id),
                proposalId: String(item._id),
                accept,
            });
            if (outcome.result !== "ok") continue;
            if (outcome.item.status === "saved") saved += 1;
            if (outcome.item.status === "dismissed") dismissed += 1;
        }

        const refreshed = await messageModel.findById(latest._id).lean();
        return {
            messageId: String(latest._id),
            saved,
            dismissed,
            reminder: waiting.every((item) => item.logType === "reminder"),
            pendingLogs: (refreshed?.pendingLogs ?? []) as IPendingLog[],
        };
    };

    private setStatus = (messageId: string, proposalId: string, status: IPendingLog["status"]) =>
        messageModel.updateOne(
            { _id: messageId, "pendingLogs._id": new Types.ObjectId(proposalId) },
            { $set: { "pendingLogs.$.status": status } },
        );

    /**
     * Write one confirmed item: her log, or the reminder she asked for. Returns the new
     * record's id where it has one.
     */
    private write = async (
        userId: string,
        item: IPendingLog,
    ): Promise<
        Types.ObjectId | null | "medicine_missing" | "reminder_limit" | "reminder_in_past"
    > => {
        if (item.logType === "reminder") {
            // Created as of now: a "today at 7 pm" card answered at 8 pm is in the past.
            const created = await this.reminders.create(userId, item.fields as never);
            if (created.result === "limit") return "reminder_limit";
            if (created.result === "in_past") return "reminder_in_past";
            return created.reminder._id as unknown as Types.ObjectId;
        }

        const context = await this.logs.getContext(userId);

        if ((APPEND_LOG_TYPES as readonly string[]).includes(item.logType)) {
            const log = await this.logs.append({
                userId,
                logType: item.logType as TAppendLogType,
                fields: item.fields,
                loggedAt: new Date(),
                source: "chat",
                context,
            });
            return log._id as unknown as Types.ObjectId;
        }

        if (item.logType === "water" || item.logType === "kicks") {
            const logType = item.logType as TDailyLogType;
            const amount = Number(item.fields[DAILY_FIELD[logType]] ?? 0);
            const log =
                item.mode === "set"
                    ? await this.logs.upsertDaily({
                          userId,
                          logType,
                          fields: { [DAILY_FIELD[logType]]: amount },
                          source: "chat",
                          context,
                      })
                    : await this.logs.addToDaily({
                          userId,
                          logType,
                          delta: amount,
                          max: DAILY_MAX[logType],
                          source: "chat",
                          context,
                      });
            return (log?._id as unknown as Types.ObjectId) ?? null;
        }

        // medicine_dose: the medicine may have been removed since the card was shown.
        const medicine = item.medicineId
            ? await this.logs.findOwnMedicine(userId, String(item.medicineId))
            : null;
        if (!medicine) return "medicine_missing";
        await this.logs.setDoseTaken({
            userId,
            medicineId: medicine._id as unknown as Types.ObjectId,
            taken: true,
            source: "chat",
            context,
        });
        return null;
    };
}

export default ChatLogProposalService;
