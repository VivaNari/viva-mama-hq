import React, { useCallback, useReducer, useMemo } from 'react';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { useAuth } from '../../context/AuthContext';
import { servicesdata, FEATURE_ROWS, FEATURES_MATRIX } from '../../data/servicesData';

import {
    SubscriptionDetailsRouteProp,
    IService,
    BillingCycle,
    PaymentStatus,
} from '../../types/subscription.types';
import { DEFAULT_PLAN, INITIAL_SUBSCRIPTION_STATE } from '../../constants/subscription';
import { subscriptionReducer } from '../../reducers/subscriptionReducer';
import { usePayment } from '../../hooks/usePayment';
import { isFreePlan, calculateFinalPrice } from '../../utils/paymentHelpers';
import { subscriptionLogger } from '../../utils/logger';
import { SubscriptionDetailsView } from './SubscriptionDetailsView';

const SubscriptionDetails: React.FC = () => {
    const route = useRoute<SubscriptionDetailsRouteProp>();
    const { completeOnboarding } = useAuth();

    const initialPlan = route.params?.plan || servicesdata[0] || DEFAULT_PLAN;
    const initialBillingCycle = route.params?.billingCycle || 'monthly';

    const [state, dispatch] = useReducer(subscriptionReducer, {
        ...INITIAL_SUBSCRIPTION_STATE,
        selectedPlan: initialPlan,
        billingCycle: initialBillingCycle,
        isInitializing: false,
    });

    const finalPrice = useMemo(() => {
        return calculateFinalPrice(state.selectedPlan, state.billingCycle);
    }, [state.selectedPlan, state.billingCycle]);

    const handleSubscriptionSuccess = useCallback(async () => {
        try {
            await completeOnboarding();
            subscriptionLogger.info('Onboarding completed, navigating to dashboard');
        } catch (error) {
            subscriptionLogger.error('Failed to complete onboarding', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to complete setup. Please try again.',
                position: 'bottom',
            });
        }
    }, [completeOnboarding]);

    const { processPayment, processFreePlan, isProcessing } = usePayment({
        selectedPlan: state.selectedPlan,
        billingCycle: state.billingCycle,
        finalPrice,
        dispatch,
        onSuccess: handleSubscriptionSuccess,
    });

    const handlePlanSelect = useCallback((plan: IService) => {
        dispatch({ type: 'SET_PLAN', payload: plan });
    }, []);

    const handleBillingCycleChange = useCallback((cycle: BillingCycle) => {
        dispatch({ type: 'SET_BILLING_CYCLE', payload: cycle });
    }, []);

    const handleSubscribe = useCallback(async () => {
        if (!state.selectedPlan) {
            subscriptionLogger.warn('No plan selected');
            Toast.show({
                type: 'info',
                text1: 'Select a Plan',
                text2: 'Please select a subscription plan to continue',
                position: 'bottom',
            });
            return;
        }

        if (isFreePlan(finalPrice)) {
            await processFreePlan();
        } else {
            await processPayment();
        }
    }, [state.selectedPlan, finalPrice, processFreePlan, processPayment]);

    const handleRetry = useCallback(() => {
        dispatch({ type: 'RESET_ERROR' });
        setTimeout(() => {
            handleSubscribe();
        }, 100);
    }, [handleSubscribe]);

    const handleDismissError = useCallback(() => {
        dispatch({ type: 'RESET_ERROR' });
    }, []);

    const paymentStatus = useMemo(() => {
        if (isProcessing) {
            return state.paymentStatus === PaymentStatus.IDLE
                ? PaymentStatus.CREATING_ORDER
                : state.paymentStatus;
        }
        if (state.error) {
            return PaymentStatus.FAILED;
        }
        return state.paymentStatus;
    }, [isProcessing, state.error, state.paymentStatus]);

    return (
        <SubscriptionDetailsView
            plans={servicesdata}
            selectedPlan={state.selectedPlan}
            billingCycle={state.billingCycle}
            paymentStatus={paymentStatus}
            error={state.error}
            featureRows={FEATURE_ROWS}
            featuresMatrix={FEATURES_MATRIX}
            onPlanSelect={handlePlanSelect}
            onBillingCycleChange={handleBillingCycleChange}
            onSubscribe={handleSubscribe}
            onRetry={handleRetry}
            onDismissError={handleDismissError}
        />
    );
};

export default SubscriptionDetails;