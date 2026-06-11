import { useReducer, useCallback, useMemo } from 'react';

import {
	SubscriptionState,
	IService,
	BillingCycle,
	UseSubscriptionReturn,
} from '../types/subscription.types';
import { subscriptionReducer, INITIAL_SUBSCRIPTION_STATE } from '../reducers/subscriptionReducer';
import { calculateFinalPrice } from '../utils/paymentHelpers';

interface UseSubscriptionProps {
	initialPlan?: IService | null;
	initialBillingCycle?: BillingCycle;
}

export const useSubscription = ({
	initialPlan = null,
	initialBillingCycle = 'monthly',
}: UseSubscriptionProps = {}): UseSubscriptionReturn => {
	const initialState: SubscriptionState = {
		...INITIAL_SUBSCRIPTION_STATE,
		selectedPlan: initialPlan,
		billingCycle: initialBillingCycle,
		isInitializing: false,
	};

	const [state, dispatch] = useReducer(subscriptionReducer, initialState);

	const selectPlan = useCallback((plan: IService) => {
		dispatch({ type: 'SET_PLAN', payload: plan });
	}, []);

	const setBillingCycle = useCallback((cycle: BillingCycle) => {
		dispatch({ type: 'SET_BILLING_CYCLE', payload: cycle });
	}, []);

	const resetError = useCallback(() => {
		dispatch({ type: 'RESET_ERROR' });
	}, []);

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' });
	}, []);

	const finalPrice = useMemo(() => {
		return calculateFinalPrice(state.selectedPlan, state.billingCycle);
	}, [state.selectedPlan, state.billingCycle]);

	return {
		state,
		selectPlan,
		setBillingCycle,
		resetError,
		reset,
		finalPrice,
	};
};