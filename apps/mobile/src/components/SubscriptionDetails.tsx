import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useState } from "react";
import {
    Dimensions,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../public/assets/colors";
import { globalStyles } from "../public/styles";
import { styles, subscriptionsDetailsStyles } from "../public/styles/subscriptionStyles";
import { IService } from "../types/services.types";
import { FEATURE_ROWS, FEATURES_MATRIX, servicesdata } from "../data/servicesData";



const SubscriptionDetails: React.FC = () => {
    const route = useRoute<any>();
    const passedPlan: IService = route.params?.plan || null;
    const initialBilling: "monthly" | "yearly" = route.params?.billingCycle || "monthly";
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(initialBilling);

    return (
        <SafeAreaView style={[subscriptionsDetailsStyles.screen, globalStyles.container]}>

            <ScrollView>
                <View style={subscriptionsDetailsStyles.card}>
                    <Text style={subscriptionsDetailsStyles.cardTitle}>Choose a plan {passedPlan.id}</Text>

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
                                    subscriptionsDetailsStyles.segmentText,
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
                                    subscriptionsDetailsStyles.segmentText,
                                    billingCycle === "yearly" && subscriptionsDetailsStyles.segmentTextActive,
                                ]}
                            >
                                Yearly
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        {servicesdata.map((p: IService, idx) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[subscriptionsDetailsStyles.planRow, idx === 0 ? { marginTop: 0 } : null, passedPlan.id == p.id && styles.planRowSelected]}
                                activeOpacity={0.8}
                                onPress={() => { }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={subscriptionsDetailsStyles.planTitle}>{p.title}</Text>
                                    <Text style={subscriptionsDetailsStyles.planSub}>
                                        {billingCycle === "yearly" ? "₹ 60000 / yearly" : ""}
                                    </Text>
                                </View>
                                <Text style={subscriptionsDetailsStyles.planPrice}>
                                    {billingCycle === "monthly" ? "₹ 4999 / mo" : "₹ 60000 / yearly"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Features comparison table */}
                <View style={{ marginVertical: 20 }}>

                    <View style={subscriptionsDetailsStyles.table}>
                        {/* header row */}
                        <View style={[subscriptionsDetailsStyles.tableRow, subscriptionsDetailsStyles.tableHeader]}>
                            <View style={[subscriptionsDetailsStyles.cell, { flex: 1 }]}>
                                <Text style={{ fontWeight: "700" }}>Features</Text>
                            </View>
                            {[...servicesdata]
                                .sort((a, b) => Number(a.id) - Number(b.id)) // Sort the array
                                .reverse() // reverse the array
                                .map((p) => (
                                    <View key={p.id} style={[subscriptionsDetailsStyles.cell, { width: 92 }]}>
                                        <Text style={{ fontWeight: "700", textAlign: "center" }}>{p.title}</Text>
                                    </View>
                                ))}
                        </View>

                        {/* rows */}
                        {FEATURE_ROWS.map((f, i) => (
                            <View key={f} style={subscriptionsDetailsStyles.tableRow}>
                                <View style={[subscriptionsDetailsStyles.cell2, { flex: 1 }]}>
                                    <Text style={{ fontSize: 12 }}>{f}</Text>
                                </View>
                                {[...servicesdata]
                                    .sort((a, b) => Number(a.id) - Number(b.id)) // sort the array
                                    .reverse() // reverse the array
                                    .map((p) => (
                                        <View key={p.id} style={[subscriptionsDetailsStyles.cell, { width: 92, alignItems: "center" }]}>
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

            {/* Floating Continue button */}

            <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                    borderRadius: 40,
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection: "row",
                    padding: 14,
                    gap: 10

                }}
            >
                <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                >
                    <Text style={{ color: colors.white, fontSize: 20, textAlign: 'center' }}>Continue</Text>
                </TouchableOpacity>
            </LinearGradient>
        </SafeAreaView>
    );
};

export default SubscriptionDetails;

