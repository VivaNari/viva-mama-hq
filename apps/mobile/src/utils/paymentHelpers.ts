import {
	SubscriptionError,
	SubscriptionErrorType,
	IRazorpayErrorResponse,
	IRazorpaySuccessResponse,
	BillingCycle,
	IService,
} from '../types/subscription.types';
import { ERROR_MESSAGES, RAZORPAY_ERROR_CODES } from '../constants/subscription';

/**
 * Calculate final price based on billing cycle
 */
export const calculateFinalPrice = (
	plan: IService | null,
	billingCycle: BillingCycle
): number => {
	console.log('Calculating final price for plan:', plan, 'and billing cycle:', billingCycle);
	if (!plan) return 0;
	return billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
};

/**
 * Check if plan is free
 */
export const isFreePlan = (price: number): boolean => {
	return price === 0;
};

/**
 * Format price for display
 */
export const formatPrice = (price: number, billingCycle: BillingCycle): string => {
	if (price === 0) return 'Free';
	const suffix = billingCycle === 'monthly' ? '/ mo' : '/ yr';

	return billingCycle === "yearly" ? `₹ ${String(price).substring(0,2)},${String(price).substring(2,5)}${suffix}` : `₹ ${price}${suffix}`;
};

/**
 * Format button text based on price
 */
export const formatSubscribeButtonText = (price: number): string => {
	console.log('Formatting subscribe button text for price:', price);
	if (price === 0) return 'Continue for free';
	return `Continue to pay ₹${price}`;
};

/**
 * Parse Razorpay error to SubscriptionError
 */
export const parseRazorpayError = (error: IRazorpayErrorResponse): SubscriptionError => {
	const { code, description } = error;

	// User cancelled payment
	if (code === RAZORPAY_ERROR_CODES.PAYMENT_CANCELLED) {
		return {
			type: SubscriptionErrorType.PAYMENT_CANCELLED,
			message: ERROR_MESSAGES.PAYMENT_CANCELLED,
			retryable: true,
			razorpayCode: code,
		};
	}

	// Network error
	if (code === RAZORPAY_ERROR_CODES.NETWORK_ERROR) {
		return {
			type: SubscriptionErrorType.NETWORK_ERROR,
			message: ERROR_MESSAGES.NETWORK_ERROR,
			retryable: true,
			razorpayCode: code,
		};
	}

	// Generic payment failure
	return {
		type: SubscriptionErrorType.PAYMENT_FAILED,
		message: description || ERROR_MESSAGES.PAYMENT_FAILED,
		retryable: true,
		razorpayCode: code,
	};
};

/**
 * Create order creation error
 */
export const createOrderCreationError = (error: unknown): SubscriptionError => {
	const message = error instanceof Error ? error.message : ERROR_MESSAGES.ORDER_CREATION_FAILED;

	return {
		type: SubscriptionErrorType.ORDER_CREATION_FAILED,
		message,
		retryable: true,
	};
};

/**
 * Create verification error
 */
export const createVerificationError = (error: unknown): SubscriptionError => {
	const message = error instanceof Error ? error.message : ERROR_MESSAGES.VERIFICATION_FAILED;

	return {
		type: SubscriptionErrorType.VERIFICATION_FAILED,
		message,
		retryable: false, // User should contact support
	};
};

/**
 * Create free plan error
 */
export const createFreePlanError = (error: unknown): SubscriptionError => {
	const message = error instanceof Error ? error.message : ERROR_MESSAGES.FREE_PLAN_FAILED;

	return {
		type: SubscriptionErrorType.FREE_PLAN_FAILED,
		message,
		retryable: true,
	};
};

/**
 * Create network error
 */
export const createNetworkError = (): SubscriptionError => {
	return {
		type: SubscriptionErrorType.NETWORK_ERROR,
		message: ERROR_MESSAGES.NETWORK_ERROR,
		retryable: true,
	};
};

/**
 * Validate Razorpay success response
 */
export const validateRazorpayResponse = (
	response: unknown
): response is IRazorpaySuccessResponse => {
	if (!response || typeof response !== 'object') return false;

	const resp = response as Record<string, unknown>;

	return (
		typeof resp.razorpay_order_id === 'string' &&
		typeof resp.razorpay_payment_id === 'string' &&
		typeof resp.razorpay_signature === 'string' &&
		resp.razorpay_order_id.length > 0 &&
		resp.razorpay_payment_id.length > 0 &&
		resp.razorpay_signature.length > 0
	);
};

/**
 * Sort plans by ID (descending for display)
 */
export const sortPlansForDisplay = (plans: IService[]): IService[] => {
	return [...plans].sort((a, b) => Number(b.id) - Number(a.id));
};