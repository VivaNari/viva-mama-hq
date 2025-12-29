import {
    SubscriptionState,
    SubscriptionAction,
    PaymentStatus,
} from '../types/subscription.types';
import { INITIAL_SUBSCRIPTION_STATE } from '../constants/subscription';

export const subscriptionReducer = (
    state: SubscriptionState,
    action: SubscriptionAction
): SubscriptionState => {
    switch (action.type) {
        case 'SET_PLAN':
            return {
                ...state,
                selectedPlan: action.payload,
                error: null, 
            };

        case 'SET_BILLING_CYCLE':
            return {
                ...state,
                billingCycle: action.payload,
            };

        case 'SET_PAYMENT_STATUS':
            return {
                ...state,
                paymentStatus: action.payload,
                // Clear error on new payment attempt
                error: action.payload === PaymentStatus.CREATING_ORDER ? null : state.error,
            };

        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload,
                paymentStatus: action.payload ? PaymentStatus.FAILED : state.paymentStatus,
            };

        case 'SET_FIRST_TIME_USER':
            return {
                ...state,
                isFirstTimeUser: action.payload,
            };

        case 'SET_INITIALIZING':
            return {
                ...state,
                isInitializing: action.payload,
            };

        case 'RESET_ERROR':
            return {
                ...state,
                error: null,
                paymentStatus: PaymentStatus.IDLE,
            };

        case 'RESET':
            return {
                ...INITIAL_SUBSCRIPTION_STATE,
                isInitializing: false,
                isFirstTimeUser: state.isFirstTimeUser,
            };

        default:
            return state;
    }
};

export { INITIAL_SUBSCRIPTION_STATE };