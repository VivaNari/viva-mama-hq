import careManagerModel from "../models/care-manager.model";
import consultationModel from "../models/consultation.model";
import expertModel from "../models/expert.model";
import UserModel from "../models/user.model";
import {
    CONSULTATION_REMINDER_OFFSETS_MINUTES,
    CONSULTATION_REMINDER_TOLERANCE_MINUTES,
} from "../constants/consultation-slots";
import { notificationMessages } from "../constants/messages";
import { CallbackRequestStatusEnum, ConsultationTypeEnum } from "../types/consultation.types";
import { formatIstDateTime } from "../utils/commonFunctions/formatIst";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export interface IConsultationReminderResult {
    due: number;
    sent: number;
    skipped: number;
    errors: number;
}

const MINUTE_MS = 60_000;

/**
 * Calendar-style reminders before a confirmed consultation.
 *
 * Runs every five minutes and pushes at each offset in
 * CONSULTATION_REMINDER_OFFSETS_MINUTES — a 5pm call is reminded at 4pm and 4:45pm.
 *
 * Three things shape the design:
 *
 * A reminder fires only once its moment has PASSED, never early. Being told "in 15
 * minutes" 20 minutes ahead is a worse lie than being told it 12 minutes ahead, and the
 * poll interval means one of the two is unavoidable.
 *
 * Every other job here dedupes by arithmetic, relying on running once a day so an
 * equality can only hold on one run. At a five-minute cadence that would re-send the
 * same reminder up to twelve times an hour, so sends are recorded on the consultation
 * and claimed with an atomic $addToSet — the update's own matched count is what decides
 * whether this run owns the send, which also settles a race between overlapping runs.
 *
 * It reads state and pushes; it creates nothing. A run that fails or never happens costs
 * a reminder, never a booking — the consultation, its Join button and its banner are all
 * unaffected.
 */
export const consultationReminders = async (
    now: Date = new Date(),
): Promise<IConsultationReminderResult> => {
    logger.info("Starting consultation reminder job");

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
        const maxOffset = Math.max(...CONSULTATION_REMINDER_OFFSETS_MINUTES);

        // Everything whose confirmed start is close enough that some offset may be due.
        // Bounded on both sides so the scan stays proportional to the next hour of
        // bookings rather than the whole table; `meeting_confirmed_at` is indexed.
        const windowStart = new Date(
            now.getTime() - CONSULTATION_REMINDER_TOLERANCE_MINUTES * MINUTE_MS,
        );
        const windowEnd = new Date(now.getTime() + maxOffset * MINUTE_MS);

        const consultations = await consultationModel
            .find({
                // A cancelled or already-handled call has nothing to remind anyone about.
                requestStatus: CallbackRequestStatusEnum.PENDING,
                meeting_confirmed_at: { $gte: windowStart, $lte: windowEnd },
            })
            .lean();

        logger.info({ count: consultations.length }, "Found consultations in the reminder window");

        for (const consultation of consultations) {
            for (const offset of CONSULTATION_REMINDER_OFFSETS_MINUTES) {
                try {
                    const confirmedAt = consultation.meeting_confirmed_at;
                    if (!confirmedAt) {
                        skipped++;
                        continue;
                    }

                    const alreadySent = consultation.reminders_sent ?? [];
                    if (alreadySent.includes(offset)) {
                        skipped++;
                        continue;
                    }

                    const dueAt = new Date(confirmedAt).getTime() - offset * MINUTE_MS;
                    const lateBy = now.getTime() - dueAt;

                    // Not yet due, or missed by so much that sending would misinform.
                    // A booking confirmed 20 minutes before the call is the ordinary case
                    // for the second branch: its 1-hour reminder is already unsendable and
                    // is left unsent rather than fired at the wrong time.
                    if (
                        lateBy < 0 ||
                        lateBy > CONSULTATION_REMINDER_TOLERANCE_MINUTES * MINUTE_MS
                    ) {
                        skipped++;
                        continue;
                    }

                    const user = await UserModel.findById(consultation.userId)
                        .select("FCM_token")
                        .lean();
                    if (!user?.FCM_token) {
                        skipped++;
                        continue;
                    }

                    // Claim the send BEFORE pushing. Two overlapping runs both reach this
                    // line; only the one whose $addToSet actually changed the document
                    // owns it, so the patient is never notified twice. A push that then
                    // fails is lost rather than retried — the alternative, claiming
                    // afterwards, risks a duplicate on every timeout, and a missed
                    // reminder is the cheaper failure.
                    const claim = await consultationModel.updateOne(
                        { _id: consultation._id, reminders_sent: { $ne: offset } },
                        { $addToSet: { reminders_sent: offset } },
                    );
                    if (claim.modifiedCount === 0) {
                        skipped++;
                        continue;
                    }

                    const consultantName = await resolveConsultantName(consultation);

                    await sendPushNotification({
                        token: user.FCM_token,
                        title: notificationMessages.CONSULTATION_REMINDER_TITLE(offset),
                        body: notificationMessages.CONSULTATION_REMINDER_BODY(
                            consultantName,
                            formatIstDateTime(new Date(confirmedAt)),
                        ),
                        data: {
                            type: "CONSULTATION_REMINDER",
                            consultationId: String(consultation._id),
                            minutesBefore: String(offset),
                        },
                    });

                    sent++;
                    logger.info(
                        { consultationId: consultation._id, offset },
                        "Sent consultation reminder",
                    );
                } catch (error: any) {
                    errors++;
                    logger.error(
                        { error: error?.message, consultationId: consultation._id, offset },
                        "Failed to send consultation reminder",
                    );
                }
            }
        }

        logger.info(
            { due: consultations.length, sent, skipped, errors },
            "Consultation reminder job completed",
        );

        return { due: consultations.length, sent, skipped, errors };
    } catch (error) {
        logger.error({ error }, "Consultation reminder job failed");
        throw error;
    }
};

/**
 * The consultant's name for the notification body. Falls back to a generic word rather
 * than failing the reminder — a deleted consultant must not cost the patient her warning
 * about a call that is still going ahead.
 */
async function resolveConsultantName(consultation: {
    consultatorId: unknown;
    consultationType: ConsultationTypeEnum;
}): Promise<string> {
    // Branched rather than picking a model into a variable: the union of two Mongoose
    // models has incompatible `findById` overloads and is not callable.
    const consultant =
        consultation.consultationType === ConsultationTypeEnum.CARE_MANAGER
            ? await careManagerModel.findById(consultation.consultatorId).select("name").lean()
            : await expertModel.findById(consultation.consultatorId).select("name").lean();

    return (consultant as { name?: string } | null)?.name ?? "your consultant";
}
