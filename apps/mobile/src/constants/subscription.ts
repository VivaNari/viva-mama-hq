import { SubscriptionState, PaymentStatus, BillingCycle, IService } from '../types/subscription.types';

// ============================================
// Async Storage Keys
// ============================================

export const ASYNC_STORAGE_KEYS = {
	FIRST_TIME_CURATING: 'is_first_time_curating_plan',
	PENDING_PAYMENT: 'pending_payment_order',
} as const;

// ============================================
// Timing Constants
// ============================================

export const CURATING_PLAN_ANIMATION_DURATION_MS = 5000;
export const PAYMENT_TIMEOUT_MS = 120000; // 2 minutes
export const API_TIMEOUT_MS = 30000; // 30 seconds

// ============================================
// Billing Cycles
// ============================================

export const BILLING_CYCLES: Record<Uppercase<BillingCycle>, BillingCycle> = {
	MONTHLY: 'monthly',
	YEARLY: 'yearly',
} as const;

// ============================================
// Default Plan (fallback)
// ============================================

export const DEFAULT_PLAN: IService = {
	id: '1',
	title: 'Viva Basic',
	monthlyPrice: 0,
	yearlyPrice: 0,
	yearlyLabel: '/year',
};

// ============================================
// Initial State
// ============================================

export const INITIAL_SUBSCRIPTION_STATE: SubscriptionState = {
	selectedPlan: null,
	billingCycle: 'monthly',
	paymentStatus: PaymentStatus.IDLE,
	error: null,
	isFirstTimeUser: false,
	isInitializing: true,
};

// ============================================
// Razorpay Configuration
// ============================================

export const RAZORPAY_CONFIG = {
	APP_NAME: 'VivaMama',
	CURRENCY: 'INR',
	DESCRIPTION_PREFIX: 'Vivama Subscription for',
} as const;

// ============================================
// Error Messages
// ============================================

// Values are i18n keys (resolved with t()/i18n.t() at the display site), not text.
export const ERROR_MESSAGES = {
	NETWORK_ERROR: 'subscription.errorMessages.networkError',
	ORDER_CREATION_FAILED: 'subscription.errorMessages.orderCreationFailed',
	PAYMENT_FAILED: 'subscription.errorMessages.paymentFailed',
	PAYMENT_CANCELLED: 'subscription.errorMessages.paymentCancelled',
	VERIFICATION_FAILED: 'subscription.errorMessages.verificationFailed',
	FREE_PLAN_FAILED: 'subscription.errorMessages.freePlanFailed',
	UNKNOWN: 'subscription.errorMessages.unknown',
} as const;

// ============================================
// Toast Messages
// ============================================

// Values are i18n keys (resolved with i18n.t() at the display site), not text.
export const TOAST_MESSAGES = {
	PAYMENT_SUCCESS: {
		title: 'common.success',
		message: 'subscription.activatedSuccess',
	},
	FREE_PLAN_SUCCESS: {
		title: 'subscription.freePlanWelcome',
		message: 'subscription.freePlanActivated',
	},
	VERIFICATION_FAILED: {
		title: 'subscription.verificationFailedTitle',
		message: 'subscription.verificationFailedToast',
	},
} as const;

// ============================================
// Razorpay Error Codes
// ============================================

export const RAZORPAY_ERROR_CODES = {
	PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
	NETWORK_ERROR: 'NETWORK_ERROR',
	BAD_REQUEST_ERROR: 'BAD_REQUEST_ERROR',
} as const;