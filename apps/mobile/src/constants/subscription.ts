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

export const ERROR_MESSAGES = {
	NETWORK_ERROR: 'Network error. Please check your connection and try again.',
	ORDER_CREATION_FAILED: 'Failed to create payment order. Please try again.',
	PAYMENT_FAILED: 'Payment failed. Please try again.',
	PAYMENT_CANCELLED: 'Payment was cancelled.',
	VERIFICATION_FAILED: 'Payment successful but verification failed. Please contact support.',
	FREE_PLAN_FAILED: 'Failed to activate free plan. Please try again.',
	UNKNOWN: 'Something went wrong. Please try again.',
} as const;

// ============================================
// Toast Messages
// ============================================

export const TOAST_MESSAGES = {
	PAYMENT_SUCCESS: {
		title: 'Success',
		message: 'Subscription activated successfully!',
	},
	FREE_PLAN_SUCCESS: {
		title: 'Welcome!',
		message: 'Your free plan is activated',
	},
	VERIFICATION_FAILED: {
		title: 'Verification Failed',
		message: 'Payment successful but verification failed. Contact support.',
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