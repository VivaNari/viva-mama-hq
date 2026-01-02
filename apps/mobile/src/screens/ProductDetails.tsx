
import Lucide from "@react-native-vector-icons/lucide";
import { useRoute, useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserProductById } from "../api/getUserProductById.ts";
import { colors } from "../public/assets/colors.ts";
import { globalStyles } from "../public/styles";
import { IUserProduct, IUserProductResponse } from "../types/product.types";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius.tsx";

const { height } = Dimensions.get("window");

const ProductDetails = () => {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { productId } = route.params;
    const [product, setProduct] = useState<IUserProduct | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const getProductById: IUserProductResponse = await getUserProductById(productId);
                setProduct(getProductById.data[0]);
            } catch (error) {
                console.error("Error fetching product:", error);
            } finally {
                setLoading(false);
            }
        })()
    }, [productId])

    if (loading) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.centerContainer]}>
                <ActivityIndicator size="large" color={colors.purple} />
                <Text style={[styles.loadingText, globalStyles.fontRegular]}>
                    Fetching product details...
                </Text>
            </SafeAreaView>
        );
    }

    if (!product) {
        return (
            <SafeAreaView style={[styles.safeArea, styles.centerContainer]}>
                <Lucide name="package-x" size={64} color="#ccc" />
                <Text style={[styles.notFoundText, globalStyles.fontSemiBold]}>
                    Product not found
                </Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonInline}>
                    <Text style={[styles.backButtonText, globalStyles.fontMedium]}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Hero Section */}
                <View style={styles.heroContainer}>
                    <Image
                        source={{ uri: product.productImageURL }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.imageOverlay}
                    >
                        {/* Header Actions */}
                        <View style={styles.headerRow}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.iconCircle}
                            >
                                <Lucide name="chevron-left" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.heroInfo}>
                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, { backgroundColor: colors.purple }]}>
                                    <Text style={[styles.badgeText, globalStyles.fontSemiBold]}>
                                        {product.productCategory}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.productName, globalStyles.fontBold]} numberOfLines={2}>
                                {product.productName}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Content Container */}
                <View style={styles.contentWrapper}>
                    {/* Price & Primary Info Card */}
                    <View style={styles.priceCard}>
                        <View>
                            <Text style={[styles.sectionLabel, globalStyles.fontMedium]}>Price Range</Text>
                            <Text style={[styles.priceText, globalStyles.fontBold]}>{product.productPriceRange}</Text>
                        </View>
                        <View style={[styles.safetyBadge, { backgroundColor: colors.yellowBadgeBG }]}>
                            <Lucide
                                name="shield-check"
                                size={18}
                                color={colors.yellowBadgeText}
                            />
                            <Text style={[
                                styles.safetyText,
                                globalStyles.fontSemiBold,
                                { color: colors.yellowBadgeText }
                            ]}>
                                {product.safetyFlag}
                            </Text>
                        </View>
                    </View>

                    {/* Week Availability Card */}
                    <View style={styles.weekCard}>
                        <Lucide name="calendar" size={22} color={colors.purple} />
                        <View style={styles.weekInfo}>
                            <Text style={[styles.weekLabel, globalStyles.fontSemiBold]}>
                                Recommended for Week {product.validWeekStart} - {product.validWeekEnd}
                            </Text>
                            <Text style={[styles.weekSubtext, globalStyles.fontRegular]}>
                                Tailored for your current stage of motherhood
                            </Text>
                        </View>
                    </View>

                    {/* Description Card */}
                    <View style={styles.detailCard}>
                        <View style={styles.cardHeader}>
                            <Lucide name="badge-info" size={20} color={colors.purple} />
                            <Text style={[styles.cardTitle, globalStyles.fontBold]}>Description</Text>
                        </View>
                        <Text style={[styles.descriptionText, globalStyles.fontRegular]}>
                            {product.productDescription}
                        </Text>
                    </View>

                    {/* Additional Info / Disclaimer */}
                    <View style={styles.disclaimerBox}>
                        <Lucide name="info" size={16} color={colors.darkGray} />
                        <Text style={[styles.disclaimerText, globalStyles.fontRegular]}>
                            Prices and availability are subject to change on the affiliate website.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.footer}>
                <GradientButtonWithSlightRadius
                    onPress={() => Linking.openURL(product.productAffiliateLink)}
                    title="Buy Now"
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.darkGray,
    },
    notFoundText: {
        marginTop: 16,
        fontSize: 20,
        color: colors.text,
    },
    backButtonInline: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        backgroundColor: colors.lightPurple,
    },
    backButtonText: {
        color: colors.purple,
        fontSize: 16,
    },
    heroContainer: {
        width: '100%',
        height: height * 0.4,
        backgroundColor: '#f0f0f0',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroInfo: {
        marginBottom: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 2,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    productName: {
        fontSize: 26,
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    contentWrapper: {
        padding: 20,
        marginTop: -20,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        flex: 1,
    },
    priceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.lightPurple + '40',
        padding: 20,
        borderRadius: 20,
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 14,
        color: colors.purple,
        marginBottom: 4,
    },
    priceText: {
        fontSize: 20,
        color: colors.text,
    },
    safetyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    safetyText: {
        fontSize: 10,
        textTransform: 'uppercase',
    },
    weekCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F8F9FE',
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E8EAF6',
    },
    weekInfo: {
        marginLeft: 12,
        flex: 1,
    },
    weekLabel: {
        fontSize: 15,
        color: colors.text,
    },
    weekSubtext: {
        fontSize: 12,
        color: colors.darkGray,
        marginTop: 2,
    },
    detailCard: {
        marginBottom: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        color: colors.text,
    },
    descriptionText: {
        fontSize: 14,
        color: colors.darkGray,
        lineHeight: 23,
    },
    disclaimerBox: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        padding: 12,
        borderRadius: 8,
        gap: 8,
        alignItems: 'center',
    },
    disclaimerText: {
        fontSize: 12,
        color: colors.darkGray,
        flex: 1,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
});

export default ProductDetails;
