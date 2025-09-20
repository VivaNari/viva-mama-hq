import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
    FlatList,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { servicesdata } from "../data/servicesData";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/subscriptionStyles";

import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";
import { productData } from "../data/productsData";
import { IProduct } from "../types/product.types";
import { FLProductItem } from "./Products";

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
                renderItem={FLProductItem}
                keyExtractor={(item: IProduct, index: number) => index.toString()}
                numColumns={2}
                columnWrapperStyle={{ gap: 2, marginBottom: 20, justifyContent: 'space-between' }}
                ListHeaderComponent={() => (
                    <View>
                        <View style={{ marginBottom: 40 }}>
                            <View style={styles.card}>
                                <Text style={[styles.cardTitle, globalStyles.fontBold]}>Choose a plan</Text>


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
                                                billingCycle === "monthly" && styles.segmentTextActive,
                                                globalStyles.fontBold
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
                                                billingCycle === "yearly" && styles.segmentTextActive,
                                                globalStyles.fontBold
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
                                                        ]}>
                                                        {billingCycle === "yearly" ? p.yearlyLabel : ""}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.planSub,
                                                        globalStyles.fontRegular
                                                    ]}>
                                                    {billingCycle === "monthly" ? p.monthlyPrice : p.yearlyPrice}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text style={[{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 10
                            }, globalStyles.fontBold]}>Suggested Products</Text>
                        </View>
                    </View>
                )}
                ListFooterComponent={() => (
                    <GradientButtonWithSlightRadius
                        title="See More"
                        onPress={() => navigation.navigate("Products")}
                    />
                )}
            />
        </SafeAreaView>
    );
};

export default Services;


