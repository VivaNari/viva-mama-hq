export const NAME_QUERY = "Please provide a valid name so that we can proceed.";
// ============================================
// Flow Configuration
// ============================================

export const WEEKLY_CHECKIN_SLUG = "weekly-checkin-v1";

export const WEEKLY_CHECKIN_FLOW_TYPE = "CHECK_IN";

// ============================================
// Timing Configuration
// ============================================

export const CHECKIN_EXPIRY_DAYS = 7; // Days after which uncompleted check-in expires
export const MAX_RETROACTIVE_WEEKS = 40; // Can complete check-ins up to 4 weeks old

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

export const NP_WOMEN_INDICATORS = ["Delivery Type", "Delivery Outcome"];
export const NN_WOMEN_INDICATORS = [
    "Conception Method",
    "Pregnancy Conditions",
    "Delivery Type",
    "Delivery Outcome",
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

export const WEEKLY_CHECKIN_NOTIFICATIONS = {
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
} as const;

// ============================================
// SSE Event Types
// ============================================

export const CHECKIN_SSE_EVENTS = {
    QUESTION: "checkin_question",
    END_FLOW: "end_flow",
    ERROR: "error",
    RECONNECT: "reconnect",
} as const;

export const REMINDER_NOTIFICATION = {
    title: "Complete Your Check-in",
    body: "Don't forget to complete your weekly health check-in.",
};
