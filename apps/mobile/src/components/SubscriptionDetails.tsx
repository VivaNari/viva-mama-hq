import { RAZORPAY_API_KEY } from "@env";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import RazorpayCheckout from 'react-native-razorpay';
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import apiClientInterceptor from "../api/apiClientInterceptor";
import { RAZORPAY_CREATE_ORDER, RAZORPAY_VERIFY_ORDER, SUBSCRIBE_FREE_PLAN } from "../constants/endpoints";
import { FEATURE_ROWS, FEATURES_MATRIX, servicesdata } from "../data/servicesData";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { styles, subscriptionsDetailsStyles } from "../public/styles/subscriptionStyles";
import { IPaymentOrderResponse, IService } from "../types/services.types";
import { useAuth } from "../context/AuthContext";

const SubscriptionDetails: React.FC<{ plan: string; billing: string }> = ({ billing }: { plan: string; billing: string }) => {
    const { completeOnboarding } = useAuth();
    const passedPlan: IService = {
        id: "string",
        title: "Viva Basic",
        monthlyPrice: 2000,
        yearlyPrice: 3000,
        yearlyLabel: "/year"
    };
    const initialBilling: "monthly" | "yearly" = billing as any || "monthly";

    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(initialBilling);
    const [activePlan, setActivePlan] = useState<IService>(passedPlan);
    const [loading, setLoading] = useState<boolean>(false);

    const finalPriceNumber = useMemo(() => {
        return billingCycle === "monthly"
            ? activePlan.monthlyPrice
            : activePlan.yearlyPrice;
    }, [billingCycle, activePlan]);

    const onPressSubscribe = async () => {
        try {
            setLoading(true);

            if (finalPriceNumber === 0) {
                // Free plan selected
                handleFreePlanSelection();
                setLoading(false);
                return;
            }
            const { data } = await apiClientInterceptor().post(RAZORPAY_CREATE_ORDER, {
                amount: finalPriceNumber,
                plan: activePlan.title,
                billingCycle: billingCycle
            }) as { data: IPaymentOrderResponse };

            const options: any = {
                description: `Vivama Subscription for ${data.data.plan}`,
                image: require("../public/assets/images/viva_logo.png"),
                currency: data.data.currency,
                key: RAZORPAY_API_KEY,
                amount: data.data.amount,
                order_id: data.data.order_id,
                name: 'VivaMama',
                prefill: {
                    // email: 'void@razorpay.com',
                    // contact: '9191919191',
                    // name: 'Razorpay Software'
                },
                theme: { color: colors.darkPurple }
            }
            RazorpayCheckout.open(options).then(async (data) => {
                try {
                    await apiClientInterceptor().post(RAZORPAY_VERIFY_ORDER, {
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature
                    });

                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Subscription activated successfully!',
                        position: 'bottom'
                    });

                    // Now complete the onboarding and navigate to dashboard
                    await completeOnboarding();

                    // Navigate to dashboard [automatically handled by the navigator setup]

                } catch (verifyError) {
                    Toast.show({
                        type: 'error',
                        text1: 'Verification Failed',
                        text2: 'Payment successful but verification failed. Contact support.',
                        position: 'bottom'
                    });
                }
            }).catch((error) => {
                setLoading(false);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: `Error: ${error.code} | ${error.description}`,
                    position: 'bottom'
                });
                console.error(`Error: ${error.code} | ${error.description}`);
            }).finally(() => {
                setLoading(false);
            })
        } catch (error: any) {
            setLoading(false);
            console.error('Payment Error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Something went wrong! Please try again.',
                position: 'bottom'
            });
        }


    }

    const handleFreePlanSelection = async () => {
        try {
            await apiClientInterceptor().post(SUBSCRIBE_FREE_PLAN, {
                plan: activePlan.title,
                billingCycle: billingCycle
            });

            // Update local state - both completed
            await completeOnboarding();

            // Navigate to dashboard [automatically handled by the navigator setup]

            Toast.show({
                type: 'success',
                text1: 'Welcome!',
                text2: 'Your free plan is activated',
                position: 'bottom'
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={[subscriptionsDetailsStyles.screen, globalStyles.container]}>
            <ScrollView>
                {/* Plan selector card */}
                <View style={subscriptionsDetailsStyles.card}>
                    <Text style={[subscriptionsDetailsStyles.cardTitle, globalStyles.fontBold]}>
                        Choose a plan
                    </Text>

                    {/* Monthly / Yearly Toggle */}
                    <View style={subscriptionsDetailsStyles.segmentRow}>
                        <TouchableOpacity
                            onPress={() => setBillingCycle("monthly")}
                            style={[
                                subscriptionsDetailsStyles.segmentBtn,
                                billingCycle === "monthly" && subscriptionsDetailsStyles.segmentBtnActive,
                            ]}
                        >
                            <Text
                                style={[
                                    globalStyles.fontBold,
                                    billingCycle === "monthly" && subscriptionsDetailsStyles.segmentTextActive,
                                ]}
                            >
                                Monthly
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setBillingCycle("yearly")}
                            style={[
                                subscriptionsDetailsStyles.segmentBtn,
                                billingCycle === "yearly" && subscriptionsDetailsStyles.segmentBtnActive,
                            ]}
                        >
                            <Text
                                style={[
                                    globalStyles.fontBold,
                                    billingCycle === "yearly" && subscriptionsDetailsStyles.segmentTextActive,
                                ]}
                            >
                                Yearly
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Select a plan */}
                    <View style={{ marginTop: 16 }}>
                        {servicesdata.map((p: IService, idx) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[
                                    subscriptionsDetailsStyles.planRow,
                                    idx === 0 && { marginTop: 0 },
                                    activePlan.id === p.id && styles.planRowSelected
                                ]}
                                activeOpacity={0.8}
                                onPress={() => setActivePlan(p)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.planTitle,
                                            globalStyles.fontSemiBold
                                        ]}
                                    >
                                        {p.title}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.planSub,
                                            globalStyles.fontRegular
                                        ]}
                                    >
                                        {billingCycle === "yearly" ? p.yearlyLabel : ""}
                                    </Text>
                                </View>

                                {/* Show price */}
                                <Text
                                    style={[
                                        styles.planSub,
                                        globalStyles.fontRegular
                                    ]}
                                >
                                    {billingCycle === "monthly" ?
                                        `₹${p.monthlyPrice} /mo` :
                                        `₹${p.yearlyPrice} /year`
                                    }
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Features Comparison Table */}
                <View style={{ marginVertical: 20 }}>
                    <View style={subscriptionsDetailsStyles.table}>
                        <View
                            style={[
                                subscriptionsDetailsStyles.tableRow,
                                subscriptionsDetailsStyles.tableHeader,
                            ]}
                        >
                            <View style={[subscriptionsDetailsStyles.cell, { flex: 1 }]}>
                                <Text style={[globalStyles.fontRegular, { fontSize: 10 }]}>
                                    Features
                                </Text>
                            </View>

                            {[...servicesdata]
                                .sort((a, b) => Number(a.id) - Number(b.id))
                                .reverse()
                                .map((p) => (
                                    <View
                                        key={p.id}
                                        style={[
                                            subscriptionsDetailsStyles.cell,
                                            { width: 92 },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                globalStyles.fontRegular,
                                                { fontSize: 10, textAlign: "center" },
                                            ]}
                                        >
                                            {p.title}
                                        </Text>
                                    </View>
                                ))}
                        </View>

                        {FEATURE_ROWS.map((f, i) => (
                            <View key={f} style={subscriptionsDetailsStyles.tableRow}>
                                <View style={[subscriptionsDetailsStyles.cell2, { flex: 1 }]}>
                                    <Text style={[globalStyles.fontRegular, { fontSize: 10 }]}>
                                        {f}
                                    </Text>
                                </View>

                                {[...servicesdata]
                                    .sort((a, b) => Number(a.id) - Number(b.id))
                                    .reverse()
                                    .map((p) => (
                                        <View
                                            key={p.id}
                                            style={[
                                                subscriptionsDetailsStyles.cell,
                                                { width: 92, alignItems: "center" },
                                            ]}
                                        >
                                            <Text style={{ fontSize: 18 }}>
                                                {FEATURES_MATRIX[p.id][i] ? "✓" : ""}
                                            </Text>
                                        </View>
                                    ))}
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Floating Continue Button */}
            <LinearGradient
                colors={[colors.darkPurple, colors.purple]}
                style={{
                    borderRadius: 40,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "row",
                    padding: 14,
                }}
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        onPressSubscribe();
                    }}
                    disabled={loading}
                    style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}
                >
                    {
                        loading && <ActivityIndicator size={20} color={colors.white} />
                    }
                    <Text
                        style={[
                            { color: colors.white, fontSize: 16, textAlign: "center" },
                            globalStyles.fontSemiBold,
                        ]}
                    >
                        {
                            finalPriceNumber === 0 ? "Continue for free" : `Continue to pay ₹${finalPriceNumber}`
                        }
                    </Text>
                </TouchableOpacity>
            </LinearGradient>
        </SafeAreaView>
    );
};

export default SubscriptionDetails;
