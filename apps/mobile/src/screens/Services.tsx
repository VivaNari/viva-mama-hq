import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
    FlatList,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { servicesdata } from "../data/servicesData";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/subscriptionStyles";

import { productData } from "../data/productsData";
import { renderFlatlistItem } from "./Products";
import { IProduct } from "../types/product.types";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "../public/assets/colors";

const Services: React.FC = () => {
    const navigation = useNavigation<any>();
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
        "monthly"
    );
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const onPressPlan = (plan: any) => {
        setSelectedPlan(plan.id);
        navigation.navigate("SubscriptionDetails", { plan, billingCycle });
    };

    return (
        <SafeAreaView style={[{ flex: 1 }, globalStyles.container]}>

            <FlatList
                data={productData.slice(0, 6)}
                renderItem={renderFlatlistItem}
                keyExtractor={(item: IProduct, index: number) => index.toString()}
                numColumns={2}
                columnWrapperStyle={{ gap: 2, marginBottom: 20, justifyContent: 'space-between' }}
                ListHeaderComponent={() => (
                    <View>
                        <View style={{ marginBottom: 40 }}>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Choose a plan</Text>


                                <View style={styles.segmentRow}>
                                    <TouchableOpacity
                                        activeOpacity={0.5}
                                        onPress={() => setBillingCycle("monthly")}
                                        style={[
                                            styles.segmentBtn,
                                            billingCycle === "monthly" && styles.segmentBtnActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                billingCycle === "monthly" && styles.segmentTextActive,
                                            ]}
                                        >
                                            Monthly
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        activeOpacity={0.5}
                                        onPress={() => setBillingCycle("yearly")}
                                        style={[
                                            styles.segmentBtn,
                                            billingCycle === "yearly" && styles.segmentBtnActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                billingCycle === "yearly" && styles.segmentTextActive,
                                            ]}
                                        >
                                            Yearly
                                        </Text>
                                    </TouchableOpacity>
                                </View>


                                <View style={{ marginTop: 16 }}>
                                    {servicesdata.map((p) => {
                                        const isSelected = selectedPlan === p.id;
                                        return (
                                            <TouchableOpacity
                                                key={p.id}
                                                onPress={() => onPressPlan(p)}
                                                activeOpacity={0.8}
                                                style={[
                                                    styles.planRow,
                                                    isSelected && styles.planRowSelected,
                                                ]}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.planTitle}>{p.title}</Text>
                                                    <Text style={styles.planSub}>
                                                        {billingCycle === "yearly" ? p.yearlyLabel : ""}
                                                    </Text>
                                                </View>
                                                <Text style={styles.planPrice}>
                                                    {billingCycle === "monthly" ? p.monthlyPrice : p.yearlyPrice}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text style={{
                                fontSize: 25,
                                fontWeight: 600,
                                marginBottom: 10
                            }}>Suggested Products</Text>
                        </View>
                    </View>
                )}
                ListFooterComponent={() => (
                    <TouchableOpacity
                        style={{ marginVertical: 20 }}
                        onPress={() => navigation.navigate("Products")}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                justifyContent: "center",
                                alignItems: "center",
                                paddingVertical: 14
                            }}
                        >
                            <Text
                                style={{
                                    color: colors.white,
                                    fontSize: 16
                                }}
                            >See More</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
};

export default Services;


