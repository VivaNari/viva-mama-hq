import Lucide from '@react-native-vector-icons/lucide'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, ScrollView, Text, TouchableOpacity, View, StyleSheet, RefreshControl } from 'react-native'
import { getActiveConsultations } from '../api/getActiveConsultatons'
import { getUserContents } from '../api/getUserContents'
import { getUserProducts } from '../api/getUserProducts'
import { ArticleCard } from '../components/ArticleCard'
import DashboardMotherTab from '../components/dashboard/DashboardMotherTab'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import ItemProduct from '../components/products/ItemProduct'
import { useAuth } from '../context/AuthContext'
import { chatDB } from '../db/sqlite'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IUserActiveConsultations, IUserActiveConsultationsResponse } from '../types/consultation.types'
import { IUserContent, IUserContentresponse } from '../types/content.types'
import { IUserAllData } from '../types/dashboard.types'
import { IUserProduct, IUserProductResponse } from '../types/product.types'
import { syncUserData } from '../utils/syncUserData'
import { useCareManagerBooking } from '../hooks/useCareManagerBooking'
import ConsultationBookingSheet from '../components/consultation/ConsultationBookingSheet'
import BookingConfirmedModal from '../components/consultation/BookingConfirmedModal'
import { useBottomSheet } from '../components/bottomSheet/AppBottomSheet'
import { PreferredSlot } from '../constants/consultationSlots'
import { AnalyticsEvent, track } from '../analytics'

const Dashboard = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [userData, setUserdata] = useState<IUserAllData>();
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const [productsData, setProductsData] = useState<IUserProduct[]>([]);
    const [userActiveConsultationsData, setUserActiveConsultationsData] = useState<IUserActiveConsultations[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { userId, userToken } = useAuth();

    const [showBookingSheet, setShowBookingSheet] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { open: openBottomSheet, close: closeBottomSheet } = useBottomSheet();

    const {
        credits: careManagerCredits,
        hasCredit: hasCareManagerCredit,
        fee,
        loading: careManagerLoading,
        book,
    } = useCareManagerBooking(() => setShowConfirmation(true));

    const handleBookingConfirmed = async (date: Date, slot: PreferredSlot) => {
        setShowBookingSheet(false);
        await book(date, slot);
        // Refresh active consultations immediately after booking completes
        fetchDashboardData();
    };

    const handleFloatingButtonPress = () => {
        openBottomSheet(
            <FloatingExpertMenu
                onBrowseExperts={() => {
                    navigation.navigate("Experts");
                }}
                onBookCounsellor={() => {
                    setShowBookingSheet(true);
                }}
                onClose={closeBottomSheet}
            />
        );
    };

    const fetchDashboardData = useCallback(async (isRefresh = false) => {
        if (!userId) return;
        if (isRefresh) {
            setRefreshing(true);
        }
        try {
            // Refresh from the API on every focus/pull-to-refresh, not just when the cache is
            // empty. current_weekdays and active_checkin change daily on the
            // server; reading only the SQLite row meant the check-in button and
            // the day countdown stayed stale until the next cold start.
            // syncUserData swallows its own errors, so a failed refresh simply
            // leaves the cached row in place.
            if (userToken) {
                await syncUserData(userToken);
            }

            const getUserDataFromSQLite = await chatDB.getUserData(userId as string);

            if (getUserDataFromSQLite) {
                setUserdata(getUserDataFromSQLite.data);
            }

            const getContents: IUserContentresponse = await getUserContents();
            setUserContentsData(getContents.data);

            const getProducts: IUserProductResponse = await getUserProducts();
            setProductsData(getProducts.data);

            const getuserActiveConsultations: IUserActiveConsultationsResponse = await getActiveConsultations();
            setUserActiveConsultationsData(getuserActiveConsultations.data);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            }
        }
    }, [userId, userToken]);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [fetchDashboardData])
    );



    const username = userData?.user.onboarding_data.preferred_name ?
        userData.user.onboarding_data.preferred_name.split(" ")[0] :
        'User';
    useEffect(() => {
        navigation.setOptions({
            headerTitle: t('dashboard.greeting', { name: username }),
        });
    }, [navigation, username, t]);

    return (
        <View
            style={{ flex: 1, position: 'relative', backgroundColor: colors.white }}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: colors.white }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            track(AnalyticsEvent.DASHBOARD_REFRESHED);
                            fetchDashboardData(true);
                        }}
                        colors={[colors.darkPurple]}
                        tintColor={colors.darkPurple}
                    />
                }
            >
                <View
                    style={[globalStyles.container, { flex: 1, backgroundColor: colors.white }]}
                >
                    <View
                    >

                        <DashboardMotherTab userData={userData as IUserAllData} userActiveConsultationsData={userActiveConsultationsData} />

                    </View>

                    {/* View to show at every tab */}
                    <View
                    >
                        {
                            userContentsData.length > 0 && (
                                <View>
                                    {/* <Text
                                style={[{
                                    fontSize: 20,
                                }, globalStyles.fontBold]}
                            >
                                Contents
                            </Text> */}
                                    <FlatList
                                        data={userContentsData.slice(1, 5)}
                                        keyExtractor={(item) => item._id.toString()}
                                        renderItem={({ item }) => (
                                            <ArticleCard
                                                key={item._id.toString()}
                                                item={item}

                                            />
                                        )}
                                        scrollEnabled={false}
                                        nestedScrollEnabled={false}
                                        columnWrapperStyle={{
                                            justifyContent: 'space-between',
                                            // Stretch, not flex-end: a one-line title next to a
                                            // three-line one used to hang off the bottom of the row
                                            // with its top out of line. Both cards now take the
                                            // row's height and start at the same y.
                                            alignItems: 'stretch',
                                        }}
                                        numColumns={2}
                                        ListHeaderComponent={
                                            <FlatList
                                                data={userContentsData.slice(0, 1)}
                                                keyExtractor={(item) => item._id.toString()}
                                                renderItem={({ item }) => (
                                                    <ArticleCard
                                                        key={item._id.toString()}
                                                        item={item}
                                                        width='full'
                                                    />
                                                )}
                                                scrollEnabled={false}
                                                nestedScrollEnabled={false}
                                            />
                                        }
                                        style={{
                                            paddingTop: 20
                                        }}
                                    />
                                    <View>
                                        <GradientButtonWithSlightRadius
                                            title={t('dashboard.seeAllContents')}
                                            onPress={() => {
                                                track(AnalyticsEvent.DASHBOARD_CARD_TAPPED, {
                                                    card_id: 'content_see_all',
                                                });
                                                navigation.navigate("Content");
                                            }}
                                        />
                                    </View>
                                </View>
                            )
                        }

                        {
                            productsData.length > 0 && (

                                <View
                                    style={{
                                        marginTop: 30
                                    }}
                                >
                                    <Text
                                        style={[{
                                            fontSize: 20
                                        }, globalStyles.fontBold]}
                                    >
                                        {t('products.suggested')}
                                    </Text>
                                    <FlatList
                                        data={productsData.slice(0, 6)}
                                        renderItem={({ item }) => <ItemProduct item={item} navigation={navigation} />}
                                        keyExtractor={(item: IUserProduct) => item._id}
                                        numColumns={2}
                                        columnWrapperStyle={{ gap: 10, marginBottom: 20, justifyContent: 'space-between' }}
                                        nestedScrollEnabled={false}
                                        scrollEnabled={false}
                                        style={{
                                            paddingTop: 20
                                        }}
                                    />
                                    <View>
                                        <GradientButtonWithSlightRadius
                                            title={t('common.seeMore')}
                                            onPress={() => {
                                                track(AnalyticsEvent.DASHBOARD_CARD_TAPPED, {
                                                    card_id: 'products_see_more',
                                                });
                                                navigation.navigate("Products");
                                            }}
                                        />
                                    </View>
                                </View>
                            )
                        }
                    </View>
                </View>
            </ScrollView>
            <TouchableOpacity
                onPress={handleFloatingButtonPress}
                style={{
                    borderRadius: 40,
                    height: 70,
                    width: 70,
                    padding: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    position: "absolute",
                    bottom: 5,
                    right: 10,
                    backgroundColor: colors.darkPurple,
                    borderWidth: 3,
                    borderColor: colors.lightPurple
                }}
            >
                <Lucide name='phone-call' color={colors.white} size={22} />
                <Text
                    style={[{
                        fontSize: 12,
                        textAlign: 'center',
                        color: colors.white,
                        letterSpacing: 0.5
                    }, globalStyles.fontSemiBold]}
                >
                    {t('dashboard.expert')}
                </Text>
            </TouchableOpacity>

            <ConsultationBookingSheet
                visible={showBookingSheet}
                onClose={() => setShowBookingSheet(false)}
                onConfirm={handleBookingConfirmed}
                title={t('careManager.requestCallTitle')}
                credits={careManagerCredits}
                feeAmount={fee}
                confirmLabel={
                    hasCareManagerCredit
                        ? t('careManager.requestWithCredit', { count: careManagerCredits })
                        : fee
                            ? t('careManager.requestWithFee', { amount: fee })
                            : t('careManager.requestCallback')
                }
                submitting={careManagerLoading}
            />

            <BookingConfirmedModal
                visible={showConfirmation}
                onDismiss={() => setShowConfirmation(false)}
            />
        </View>
    )
}

interface FloatingExpertMenuProps {
    onBrowseExperts: () => void;
    onBookCounsellor: () => void;
    onClose: () => void;
}

const FloatingExpertMenu = ({ onBrowseExperts, onBookCounsellor, onClose }: FloatingExpertMenuProps) => {
    const { t } = useTranslation();

    return (
        <View style={styles.menuContainer}>
            <Text style={[globalStyles.fontBold, styles.menuTitle]}>
                {t('dashboard.floatingMenuTitle')}
            </Text>
            <Text style={[globalStyles.fontRegular, styles.menuSubtitle]}>
                {t('dashboard.floatingMenuSubtitle')}
            </Text>

            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    onClose();
                    onBookCounsellor();
                }}
                style={styles.menuItem}
            >
                <View style={[styles.iconContainer, { backgroundColor: colors.lightPurple }]}>
                    <Lucide name="phone-call" size={20} color={colors.purple} />
                </View>
                <View style={styles.menuTextContainer}>
                    <Text style={[globalStyles.fontBold, styles.itemTitle]}>
                        {t('dashboard.floatingMenuCounsellor')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.itemDesc]}>
                        {t('dashboard.floatingMenuCounsellorDesc')}
                    </Text>
                </View>
                <Lucide name="chevron-right" size={20} color={colors.purple} />
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    onClose();
                    onBrowseExperts();
                }}
                style={[styles.menuItem, { marginTop: 12 }]}
            >
                <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                    <Lucide name="users" size={20} color="#1E88E5" />
                </View>
                <View style={styles.menuTextContainer}>
                    <Text style={[globalStyles.fontBold, styles.itemTitle]}>
                        {t('dashboard.floatingMenuBrowse')}
                    </Text>
                    <Text style={[globalStyles.fontRegular, styles.itemDesc]}>
                        {t('dashboard.floatingMenuBrowseDesc')}
                    </Text>
                </View>
                <Lucide name="chevron-right" size={20} color="#1E88E5" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    menuContainer: {
        paddingBottom: 25,
    },
    menuTitle: {
        fontSize: 18,
        color: colors.black,
        marginBottom: 4,
    },
    menuSubtitle: {
        fontSize: 12,
        color: colors.gray,
        marginBottom: 20,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.SubscriptionOptionsBG,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuTextContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        color: colors.darkPurple,
        marginBottom: 2,
    },
    itemDesc: {
        fontSize: 11,
        color: colors.darkGray,
    },
});

export default Dashboard;