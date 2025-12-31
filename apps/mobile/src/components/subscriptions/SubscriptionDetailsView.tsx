import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { globalStyles } from '../../public/styles';
import { colors } from '../../public/assets/colors';
import { SubscriptionDetailsViewProps, PaymentStatus } from '../../types/subscription.types';

import { BillingToggle } from './BillingToggle';
import { PlanSelector } from './PlanSelector';
import { FeaturesTable } from './FeaturesTable';
import { SubscribeButton } from './SubscribeButton';
import { ErrorDisplay } from './ErrorDisplay';
import { calculateFinalPrice } from '../../utils/paymentHelpers';

export const SubscriptionDetailsView: React.FC<SubscriptionDetailsViewProps> = ({
    plans,
    selectedPlan,
    billingCycle,
    paymentStatus,
    error,
    featureRows,
    featuresMatrix,
    onPlanSelect,
    onBillingCycleChange,
    onSubscribe,
    onRetry,
    onDismissError,
}) => {
    const isProcessing =
        paymentStatus === PaymentStatus.CREATING_ORDER ||
        paymentStatus === PaymentStatus.AWAITING_PAYMENT ||
        paymentStatus === PaymentStatus.VERIFYING;

    const finalPrice = calculateFinalPrice(selectedPlan, billingCycle);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={[styles.cardTitle, globalStyles.fontBold]}>
                        Choose a plan
                    </Text>

                    <BillingToggle
                        billingCycle={billingCycle}
                        onCycleChange={onBillingCycleChange}
                        disabled={isProcessing}
                    />

                    <PlanSelector
                        plans={plans}
                        selectedPlan={selectedPlan}
                        billingCycle={billingCycle}
                        onPlanSelect={onPlanSelect}
                        disabled={isProcessing}
                    />
                </View>

                <FeaturesTable
                    selectedPlan={selectedPlan}
                    featureRows={featureRows}
                    featuresMatrix={featuresMatrix}
                />
            </ScrollView>

            <View style={styles.buttonContainer}>
                <SubscribeButton
                    price={finalPrice}
                    isLoading={isProcessing}
                    disabled={!selectedPlan || isProcessing}
                    onPress={onSubscribe}
                />
            </View>

            <ErrorDisplay
                error={error}
                onRetry={onRetry}
                onDismiss={onDismissError}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 24,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 16,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 0,
    },
    cardTitle: {
        fontSize: 20,
        color: colors.black,
        marginBottom: 16,
        textAlign: "center"
    },
    buttonContainer: {
        padding: 16,
        paddingBottom: 8,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});