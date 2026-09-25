import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../types/chat.types";

export const NAME_QUERY = "Please provide a valid name so that we can proceed.";
// ============================================
// Flow Configuration
// ============================================

export const WEEKLY_CHECKIN_SLUG = "weekly-checkin-v1";

/**
 * Per-child onboarding. Runs on the same guided-flow engine as the mother flows, but is
 * the only slug whose instances carry a subjectChildId and whose answers project into
 * users.childs[] rather than users.onboarding_data.
 */
export const BABY_ONBOARDING_SLUG = "baby-onboarding-v1";

export const WEEKLY_CHECKIN_FLOW_TYPE = "CHECK_IN";

// ============================================
// Timing Configuration
// ============================================

export const CHECKIN_EXPIRY_DAYS = 7; // Days after which uncompleted check-in expires

export const CHECKIN_REMINDER_INTERVALS = [1, 3, 5]; // Days after trigger to send reminders

// ============================================
// Node Elimination Configuration
// ============================================

export const ELIMINATION_INDICATORS = [
    "Lochia / Bleeding",
    "Perineal/C-section Wound",
    "Mobility/Movement",
    "Constipation",
];

export const BREASTFEEDING_DEPENDENT_INDICATORS = ["Lactation Status", "Supplement Adherence"];

/**
 * Indicators to HIDE from each category — the names read the other way round, but
 * FlowService.isNodeValidForNPWomen/isNodeValidForNNWomen answer `isEligible: !isNPWomen`,
 * so a node listed here is skipped for that category and shown to everyone else.
 *
 * This is the live gate for the app's onboarding as well as the weekly check-in: both run
 * through POST /chat/checkin/{start,answer}. ChatFlowService.isPregnancyRelatedNode and
 * isFutureDeliveryRalatedNode express the same rules by node `id` for the websocket path —
 * keep the two in step.
 */
export const NP_WOMEN_INDICATORS = [
    "Delivery Type",
    "Delivery Outcome",
    // No baby to feed yet.
    "Feeding Method",
];
export const NN_WOMEN_INDICATORS = [
    "Conception Method",
    "Pregnancy Conditions",
    "Delivery Type",
    "Delivery Outcome",
    "Feeding Method",
    "Social Support",
    "Parity",
];

export const STOPPED_BREASTFEEDING_SCORE = -1;

// ============================================
// Messages
// ============================================

export const WEEKLY_CHECKIN_MESSAGES = {
    THANK_YOU:
        "Thank you for completing your check-in! Your score is being generated. Please check the dashboard.",
    ALREADY_COMPLETED: "You have already completed the check-in for this week.",
    NOT_TRIGGERED: "Weekly check-in has not been triggered for this week yet.",
    EXPIRED: "This weekly check-in has expired.",
    FLOW_NOT_FOUND: "Weekly check-in flow not found.",
    INVALID_WEEK: "Invalid week specified for check-in.",
    RECONNECTED: "Reconnected to existing check-in session.",
} as const;

// ============================================
// Notification Templates
// ============================================

interface NotificationCopy {
    title: string;
    body: string;
}

type CheckinNotificationKey = "NEW_CHECKIN" | "REMINDER" | "COMPLETED";

/**
 * Localized weekly check-in push-notification copy, keyed by language code.
 * Add a new language by adding a bundle; missing languages/keys fall back to
 * English via `getCheckinNotification`.
 */
export const WEEKLY_CHECKIN_NOTIFICATIONS_I18N: Record<
    FlowLanguage,
    Record<CheckinNotificationKey, NotificationCopy>
> = {
    en: {
        NEW_CHECKIN: {
            title: "Weekly Check-in Available",
            body: "Your weekly health check-in is ready. Take a few minutes to track your progress.",
        },
        REMINDER: {
            title: "Complete Your Check-in",
            body: "Don't forget to complete your weekly health check-in.",
        },
        COMPLETED: {
            title: "Check-in Complete",
            body: "Great job! Your weekly check-in has been submitted.",
        },
    },
    hi: {
        NEW_CHECKIN: {
            title: "साप्ताहिक जाँच उपलब्ध है",
            body: "आपकी साप्ताहिक स्वास्थ्य जाँच तैयार है। अपनी प्रगति ट्रैक करने के लिए कुछ मिनट निकालें।",
        },
        REMINDER: {
            title: "अपनी जाँच पूरी करें",
            body: "अपनी साप्ताहिक स्वास्थ्य जाँच पूरी करना न भूलें।",
        },
        COMPLETED: {
            title: "जाँच पूरी हुई",
            body: "बहुत बढ़िया! आपकी साप्ताहिक जाँच जमा हो गई है।",
        },
    },
};

/**
 * Resolve a weekly check-in notification's copy for the given language,
 * falling back to English when the language or key is unavailable.
 */
export const getCheckinNotification = (
    key: CheckinNotificationKey,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): NotificationCopy => {
    const bundle = WEEKLY_CHECKIN_NOTIFICATIONS_I18N[lang] ?? WEEKLY_CHECKIN_NOTIFICATIONS_I18N.en;
    return bundle[key] ?? WEEKLY_CHECKIN_NOTIFICATIONS_I18N.en[key];
};

// Backward-compatible English alias.
export const WEEKLY_CHECKIN_NOTIFICATIONS = WEEKLY_CHECKIN_NOTIFICATIONS_I18N.en;

// ============================================
// Flow completion ("thank you") messages
// ============================================

type FlowCompletionKey = "ONBOARDING" | "CHECK_IN" | "BABY_ONBOARDING";

/**
 * Localized end-of-flow messages shown when onboarding or a weekly check-in
 * finishes. Missing languages fall back to English via getFlowCompletionMessage.
 */
export const FLOW_COMPLETION_MESSAGES_I18N: Record<
    FlowLanguage,
    Record<FlowCompletionKey, string>
> = {
    en: {
        ONBOARDING:
            "Thank you! That gives me a clear picture of your health, support, and daily life. I will now build your personalised recovery journey and connect you with the right support.",
        CHECK_IN:
            "Thank you for completing your check-in! Your score is being generated. Please check the dashboard.",
        BABY_ONBOARDING:
            "All set! I've added your little one. You can now track growth, feeding, diapers, vaccinations and milestones from the Infant tab on your dashboard.",
    },
    hi: {
        ONBOARDING:
            "धन्यवाद, अब मुझे आपकी सेहत, सहारे और रोज़मर्रा की ज़िंदगी की स्पष्ट तस्वीर मिल गई है। मैं अब आपकी journey personalise करूँगी। हर रिकवरी अलग होती है, और मैं हर कोमल दिन आपके साथ चलूँगी।",
        CHECK_IN:
            "आपकी जाँच पूरी करने के लिए धन्यवाद! आपका स्कोर तैयार किया जा रहा है। कृपया डैशबोर्ड देखें।",
        BABY_ONBOARDING:
            "हो गया! मैंने आपके नन्हे को जोड़ दिया है। अब आप अपने डैशबोर्ड के Infant टैब से ग्रोथ, फीडिंग, डायपर, टीकाकरण और माइलस्टोन ट्रैक कर सकती हैं।",
    },
};

/** Resolve an end-of-flow message for the given language, falling back to English. */
export const getFlowCompletionMessage = (
    key: FlowCompletionKey,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): string => {
    const bundle = FLOW_COMPLETION_MESSAGES_I18N[lang] ?? FLOW_COMPLETION_MESSAGES_I18N.en;
    return bundle[key] ?? FLOW_COMPLETION_MESSAGES_I18N.en[key];
};

/**
 * Localized, grief-sensitive acknowledgement shown when a user reports a
 * stillbirth during onboarding. The questionnaire is terminated early and the
 * user is offered expert/AI support instead of further questions.
 */
export const STILL_BIRTH_ACK_MESSAGE_I18N: Record<FlowLanguage, string> = {
    en: "We are extremely sorry for your loss. You can connect with one of our experts or chat with our Viva AI assistant for further support whenever you feel ready.",
    hi: "हमें आपके दुख का गहरा अफ़सोस है। जब भी आप तैयार महसूस करें, आप हमारे किसी विशेषज्ञ से जुड़ सकती हैं या आगे की सहायता के लिए हमारी Viva AI सहायक से बात कर सकती हैं।",
};

/** Resolve the stillbirth acknowledgement for the given language, falling back to English. */
export const getStillBirthAckMessage = (lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE): string => {
    return STILL_BIRTH_ACK_MESSAGE_I18N[lang] ?? STILL_BIRTH_ACK_MESSAGE_I18N.en;
};

// ============================================
// Score-ready push notification
// ============================================

/**
 * Localized push-notification copy sent once a weekly check-in score has been
 * generated. Missing languages fall back to English via getScoreReadyNotification.
 */
export const SCORE_READY_NOTIFICATION_I18N: Record<FlowLanguage, NotificationCopy> = {
    en: {
        title: "Your new Viva Score is available!",
        body: "Tap to view your personalized recommendations and insights.",
    },
    hi: {
        title: "आपका नया विवा स्कोर उपलब्ध है!",
        body: "अपनी व्यक्तिगत सिफ़ारिशें और जानकारी देखने के लिए टैप करें।",
    },
};

/** Resolve the score-ready notification copy for the given language. */
export const getScoreReadyNotification = (
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): NotificationCopy => {
    return SCORE_READY_NOTIFICATION_I18N[lang] ?? SCORE_READY_NOTIFICATION_I18N.en;
};

// ============================================
// Growth-log nudge push notification
// ============================================

/**
 * Localized push-notification copy sent right after a vaccination dose is logged, nudging
 * the parent to also log today's growth. `{{child_name}}` is interpolated at send time,
 * matching the placeholder convention the baby-onboarding flow already uses.
 */
export const GROWTH_LOG_NUDGE_NOTIFICATION_I18N: Record<FlowLanguage, NotificationCopy> = {
    en: {
        title: "Don't forget growth!",
        body: "You just logged a vaccination for {{child_name}}. While you're at it, log today's growth too.",
    },
    hi: {
        title: "ग्रोथ लॉग करना न भूलें!",
        body: "आपने अभी {{child_name}} का टीकाकरण लॉग किया है। साथ ही आज की ग्रोथ भी लॉग कर लें।",
    },
};

/** Resolve the growth-log nudge notification copy for the given language. */
export const getGrowthLogNudgeNotification = (
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): NotificationCopy => {
    return GROWTH_LOG_NUDGE_NOTIFICATION_I18N[lang] ?? GROWTH_LOG_NUDGE_NOTIFICATION_I18N.en;
};

// ============================================
// Baby age-reminder push notifications (vaccination/milestone due)
// ============================================

/**
 * Localized push copy for the daily age-reminder job. `{{child_name}}` and `{{count}}`
 * are interpolated at send time. Deliberately generic about *which* visit/band — the
 * catalogue that would name it is display-only data that lives in the mobile app's own
 * generated files, not in the backend (see `@vivamama/infant-schedules`'s own doc comment
 * on why), so the push says "what" (count) and the app screen says "which" once opened.
 */
export const VACCINATION_DUE_NOTIFICATION_I18N: Record<FlowLanguage, NotificationCopy> = {
    en: {
        title: "Vaccination due",
        body: "{{count}} vaccination(s) may be due for {{child_name}}. Open the Vaccination Log to check.",
    },
    hi: {
        title: "टीकाकरण देय है",
        body: "{{child_name}} के लिए {{count}} टीकाकरण देय हो सकते हैं। जाँचने के लिए टीकाकरण लॉग खोलें।",
    },
};

/** Resolve the vaccination-due notification copy for the given language. */
export const getVaccinationDueNotification = (
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): NotificationCopy => {
    return VACCINATION_DUE_NOTIFICATION_I18N[lang] ?? VACCINATION_DUE_NOTIFICATION_I18N.en;
};

export const MILESTONE_DUE_NOTIFICATION_I18N: Record<FlowLanguage, NotificationCopy> = {
    en: {
        title: "New milestones to check",
        body: "{{child_name}} may have reached new milestones. Open the Milestone Log to check them off.",
    },
    hi: {
        title: "नए माइलस्टोन देखें",
        body: "{{child_name}} ने नए माइलस्टोन हासिल किए हो सकते हैं। जाँचने के लिए माइलस्टोन लॉग खोलें।",
    },
};

/** Resolve the milestone-due notification copy for the given language. */
export const getMilestoneDueNotification = (
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): NotificationCopy => {
    return MILESTONE_DUE_NOTIFICATION_I18N[lang] ?? MILESTONE_DUE_NOTIFICATION_I18N.en;
};

// ============================================
// SSE Event Types
// ============================================

export const CHECKIN_SSE_EVENTS = {
    QUESTION: "checkin_question",
    END_FLOW: "end_flow",
    ERROR: "error",
    RECONNECT: "reconnect",
} as const;

// Backward-compatible English alias; prefer getCheckinNotification("REMINDER", lang).
export const REMINDER_NOTIFICATION = WEEKLY_CHECKIN_NOTIFICATIONS_I18N.en.REMINDER;
