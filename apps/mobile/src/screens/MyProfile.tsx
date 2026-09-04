import Lucide from '@react-native-vector-icons/lucide'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Image, Text, TouchableOpacity, View, Linking, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import DeleteAccountModal from '../components/profile/DeleteAccountModal'
import ProfileSettingsMenu from '../components/profile/ProfileSettingsMenu'
import { useAuth } from '../context/AuthContext'
import { settingsMenu } from '../data/myProfileData'
import { chatDB } from '../db/sqlite'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IUserAllData } from '../types/dashboard.types'
import { syncUserData } from '../utils/syncUserData'
import { recordError, triggerCrash } from '../analytics'

const MyProfile = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const { signOut, deleteAccount } = useAuth();
    const [getLoading, setLoading] = useState<boolean>(false);
    const [userData, setUserdata] = useState<IUserAllData>();
    const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    /**
     * On success the modal is deliberately left mounted: `deleteAccount` clears the
     * token, which swaps the navigator back to the auth stack and unmounts this screen
     * anyway. Closing it first would flash the profile behind it mid-teardown.
     */
    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await deleteAccount();
        } catch (error) {
            console.error('Account deletion failed', error);
            recordError(error, 'MyProfile.deleteAccount');
            setShowDeleteModal(false);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('deleteAccount.failed'),
            });
        } finally {
            setDeleting(false);
        }
    };
    const { userId, userToken } = useAuth();

    // Screen views are logged centrally by the NavigationContainer in
    // RootNavigator — no per-screen listener needed here or anywhere else.

    // const handleInAppReview = () => {
    //     // NOTE: In-App Review only shows up in Production/Internal Test Track on Play Store.
    //     // It will NOT show on debug builds or sideloaded APKs.
    //     if (InAppReview.isAvailable()) {
    //         InAppReview.RequestInAppReview()
    //             .then((hasFlowFinishedSuccessfully) => {
    //                 console.log('In-App Review flow finished successfully:', hasFlowFinishedSuccessfully);
    //             })
    //             .catch((error) => {
    //                 console.log('In-App Review Error:', error);
    //                 openStoreFallback();
    //             });
    //     } else {
    //         openStoreFallback();
    //     }
    // };

    // const openStoreFallback = () => {
    //     const GOOGLE_PACKAGE_NAME = 'com.wellnessemporio.vivamama';
    //     const url = Platform.OS === 'ios'
    //         ? `itms-apps://itunes.apple.com/app/viewContentsUserReviews/idYOUR_APPLE_ID?action=write-review`
    //         : `market://details?id=${GOOGLE_PACKAGE_NAME}`;

    //     Linking.openURL(url).catch(() => {
    //         // If play store app is not available, open in browser
    //         const browserUrl = `https://play.google.com/store/apps/details?id=${GOOGLE_PACKAGE_NAME}`;
    //         Linking.openURL(browserUrl);
    //     });
    // };

    useFocusEffect(useCallback(() => {
        (async function () {

            let getUserDataFromSQLite = await chatDB.getUserData(userId as string);

            // Fallback: If no data in SQLite, try to sync from API
            if (!getUserDataFromSQLite && userToken) {
                console.log("[PROFILE] No local data, attempting fallback sync...");
                await syncUserData(userToken);
                getUserDataFromSQLite = await chatDB.getUserData(userId as string);
            }

            if (getUserDataFromSQLite) {
                setUserdata(getUserDataFromSQLite.data);
            }
        })()
    }, [userId, userToken]));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['bottom', 'left', 'right']}>
            <DeleteAccountModal
                visible={showDeleteModal}
                deleting={deleting}
                onConfirm={handleDeleteAccount}
                onDismiss={() => setShowDeleteModal(false)}
            />

            {/* Disclaimer Modal */}
            <Modal
                visible={showDisclaimerModal}
                transparent={true}
                animationType="fade"
            >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[globalStyles.fontBold, { fontSize: 20, color: colors.darkPurple, flex: 1 }]}>{t('profile.medicalDisclaimer')}</Text>
                            <TouchableOpacity onPress={() => setShowDisclaimerModal(false)}>
                                <Lucide name="x" size={24} color={colors.black} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            {t('profile.disclaimerBody1')}
                        </Text>
                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            {t('profile.disclaimerBody2')}
                        </Text>
                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            {t('profile.disclaimerBody3')}
                        </Text>

                        <TouchableOpacity
                            onPress={() => setShowDisclaimerModal(false)}
                            style={{ padding: 12, borderRadius: 30, backgroundColor: colors.darkPurple, marginTop: 10 }}
                        >
                            <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>{t('common.close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <FlatList
                data={settingsMenu}
                renderItem={({ item, index }) => {
                    const isFirst = index === 0
                    const isLast = index === settingsMenu.length - 1

                    return (
                        <View
                            style={{
                                marginHorizontal: 20,

                            }}
                        >
                            <ProfileSettingsMenu
                                item={item}
                                navigation={navigation}
                                isFirst={isFirst}
                                isLast={isLast}
                                onAction={(action) => {
                                    if (action === 'CHANGE_LANGUAGE') {
                                        navigation.navigate('LanguageSelection', { mode: 'settings' });
                                    } else if (action === 'DELETE_ACCOUNT') {
                                        setShowDeleteModal(true);
                                    }
                                }}
                            />
                        </View>
                    )
                }}
                keyExtractor={(_, index) => index.toString()}
                showsVerticalScrollIndicator={false}

                ListHeaderComponent={() => (
                    <>
                        {/* Profile Card */}

                        <View
                            style={[globalStyles.container, {
                                backgroundColor: colors.pageBG,
                                borderRadius: 10,
                                paddingVertical: 30,
                                marginBottom: 20,

                            }]}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    gap: 20,
                                }}
                            >
                                <View>
                                    <Image
                                        source={require("../public/assets/images/avatar_mom.png")}
                                        style={{
                                            height: 70,
                                            width: 70,
                                            borderRadius: 75,
                                            borderWidth: 2,
                                            borderColor: colors.purple,
                                        }}
                                        resizeMode='contain'
                                    />

                                </View>

                                <View
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'

                                    }}
                                >

                                    <View>

                                        <Text
                                            style={[{
                                                fontSize: 18,
                                                marginBottom: 5
                                            }, globalStyles.fontSemiBold]}
                                        >
                                            {userData?.user.onboarding_data.preferred_name}
                                        </Text>

                                        {(() => {
                                            if (!userData || !userData.user.subscription) return null;

                                            const sub = userData.user.subscription;
                                            // Handle both new (tier, currentPeriodEnd) and old (plan, expiryDate) formats
                                            // currentPeriodEnd  → active premium users
                                            // trialEndAt        → users currently on a trial (currentPeriodEnd is null during trial)
                                            // expiryDate        → legacy schema fallback
                                            const expiry = (sub as any).currentPeriodEnd || (sub as any).trialEndAt || (sub as any).expiryDate;
                                            const isExpired = !expiry || new Date(expiry) < new Date();
                                            const plan = ((sub as any).tier || (sub as any).plan)?.toUpperCase();

                                            if (isExpired || plan === 'FREE') {
                                                return (
                                                    <TouchableOpacity
                                                        onPress={() => navigation.navigate("SubscriptionDetails" as never)}
                                                        style={{
                                                            backgroundColor: colors.darkPurple,
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 10,
                                                            borderRadius: 15,
                                                            alignSelf: 'flex-start'
                                                        }}
                                                    >
                                                        <Text
                                                            style={[{
                                                                color: colors.white,
                                                                textAlign: 'center',
                                                                fontSize: 10
                                                            }, globalStyles.fontRegular]}
                                                        >
                                                            {t('profile.getPremium')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            } else if (plan === 'TRIAL') {
                                                const daysLeft = expiry ? Math.ceil((new Date(expiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;
                                                return (
                                                    <View style={{
                                                        backgroundColor: colors.lightPurple,
                                                        paddingVertical: 6,
                                                        paddingHorizontal: 10,
                                                        borderRadius: 15,
                                                        alignSelf: 'flex-start'
                                                    }}>
                                                        <Text
                                                            style={[{
                                                                color: colors.darkPurple,
                                                                textAlign: 'center',
                                                                fontSize: 10
                                                            }, globalStyles.fontRegular]}
                                                        >
                                                            {/* Two explicit keys rather than an i18next plural:
                                                                nothing else in this app uses plural resolution, and a
                                                                missing Intl.PluralRules would render the raw key on the
                                                                profile card. */}
                                                            {daysLeft === 1
                                                                ? t('profile.trialEndsInDay')
                                                                : t('profile.trialEndsInDays', { count: daysLeft })}
                                                        </Text>
                                                    </View>
                                                );
                                            } else {
                                                const expiryDate = expiry
                                                    ? new Date(expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : null;
                                                return (
                                                    <View
                                                        style={{
                                                            flexDirection: 'row',
                                                            gap: 5,
                                                            alignItems: 'flex-start',
                                                        }}
                                                    >

                                                        <View style={{
                                                            backgroundColor: colors.darkPurple,
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 10,
                                                            borderRadius: 15,
                                                            alignSelf: 'flex-start'
                                                        }}>
                                                            <Text
                                                                style={[{
                                                                    color: colors.white,
                                                                    textAlign: 'center',
                                                                    fontSize: 10
                                                                }, globalStyles.fontRegular]}
                                                            >
                                                                {plan === 'LITE' ? 'Viva Lite' : 'Viva Signature'}
                                                            </Text>
                                                        </View>
                                                        {expiryDate && (
                                                            <View style={{
                                                                borderColor: colors.darkPurple,
                                                                borderWidth: 1,
                                                                paddingVertical: 6,
                                                                paddingHorizontal: 10,
                                                                borderRadius: 15,
                                                                alignSelf: 'flex-start'
                                                            }}>

                                                                <Text
                                                                    style={[{
                                                                        color: colors.darkPurple,
                                                                        textAlign: 'center',
                                                                        fontSize: 9,
                                                                        opacity: 1,
                                                                        marginTop: 2
                                                                    }, globalStyles.fontRegular]}
                                                                >
                                                                    Ends {expiryDate}
                                                                </Text>

                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            }
                                        })()}

                                    </View>

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate("EditProfile")}
                                        activeOpacity={0.7}
                                        style={{
                                            padding: 6,
                                            borderRadius: 15,
                                            marginTop: 10,
                                        }}
                                    >
                                        <Lucide
                                            name='chevron-right'
                                            color={colors.darkPurple}
                                            size={20}
                                        />
                                    </TouchableOpacity>

                                </View>
                            </View>
                        </View>
                    </>
                )}

                // Footer
                ListFooterComponent={() => (
                    <View
                        style={{
                            marginHorizontal: 20,

                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.4}
                            onPress={() => setShowDisclaimerModal(true)}
                            style={{
                                flexDirection: "row",
                                gap: 5,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingVertical: 10,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                            }}
                        >
                            <Lucide name={"shield-alert"} size={20} color={colors.darkGray} />
                            <View
                                style={{
                                    flex: 1,
                                }}
                            >
                                <Text
                                    style={[{
                                        fontSize: 16,
                                        flex: 1,
                                        marginLeft: 10
                                    }, globalStyles.fontSemiBold]}
                                >
                                    {t('profile.medicalDisclaimer')}
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 14,
                                        paddingBottom: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                                        flex: 1,
                                        marginLeft: 10,
                                        color: colors.darkGray
                                    }, globalStyles.fontRegular]}
                                >
                                    {t('profile.medicalDisclaimerShortDesc')}
                                </Text>
                            </View>
                            <View
                                style={{
                                    padding: 5,
                                    height: 30,
                                    width: 30,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: colors.pageBG,
                                    borderRadius: '50%',
                                }}
                            >
                                <Lucide name={'chevron-right'} size={20} color={colors.darkPurple} />
                            </View>
                        </TouchableOpacity>
                        {/* <TouchableOpacity
                            activeOpacity={0.4}
                            onPress={handleInAppReview}
                            style={{
                                flexDirection: "row",
                                gap: 5,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingVertical: 10,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                            }}
                        >
                            <Lucide name={"star"} size={20} color={colors.darkGray} />
                            <View
                                style={{
                                    flex: 1,
                                }}
                            >
                                <Text
                                    style={[{
                                        fontSize: 16,
                                        flex: 1,
                                        marginLeft: 10
                                    }, globalStyles.fontSemiBold]}
                                >
                                    {t('profile.reviewUs')}
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 14,
                                        paddingBottom: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                                        flex: 1,
                                        marginLeft: 10,
                                        color: colors.darkGray
                                    }, globalStyles.fontRegular]}
                                >
                                    {t('profile.reviewUsDesc')}
                                </Text>
                            </View>
                            <View
                                style={{
                                    padding: 5,
                                    height: 30,
                                    width: 30,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: colors.pageBG,
                                    borderRadius: '50%',
                                }}
                            >
                                <Lucide name={'chevron-right'} size={20} color={colors.darkPurple} />
                            </View>
                        </TouchableOpacity> */}
                        <TouchableOpacity
                            activeOpacity={0.4}
                            onPress={() => {
                                setLoading(true);
                                setTimeout(() => {
                                    signOut()
                                    setLoading(false);
                                }, 500);
                            }}
                            style={{
                                flexDirection: "row",
                                gap: 5,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingVertical: 10,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                            }}
                        >
                            <Lucide name={"log-out"} size={20} color={colors.darkGray} />
                            <View
                                style={{
                                    flex: 1,
                                }}
                            >
                                <Text
                                    style={[{
                                        fontSize: 16,
                                        flex: 1,
                                        marginLeft: 10
                                    }, globalStyles.fontSemiBold]}
                                >
                                    {
                                        getLoading ? t('profile.signingOut') : t('profile.signOut')
                                    }
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 14,
                                        paddingBottom: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                                        flex: 1,
                                        marginLeft: 10,
                                        color: colors.darkGray
                                    }, globalStyles.fontRegular]}
                                >
                                    {t('profile.signOutDesc')}
                                </Text>
                            </View>
                            <View
                                style={{
                                    padding: 5,
                                    height: 30,
                                    width: 30,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: colors.pageBG,
                                    borderRadius: '50%',
                                }}
                            >
                                <Lucide name={'chevron-right'} size={20} color={colors.darkPurple} />
                            </View>
                        </TouchableOpacity>
                        {/* Debug builds only — never ship a "crash the app" button to
                            real users. Kept rather than deleted so re-verifying the
                            Crashlytics pipeline after an SDK or Gradle upgrade stays a
                            one-tap job. `triggerCrash` is itself a no-op outside __DEV__. */}
                        {__DEV__ && (
                        <TouchableOpacity
                            activeOpacity={0.4}
                            onPress={() => {
                                triggerCrash();
                            }}
                            style={{
                                flexDirection: "row",
                                gap: 5,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingVertical: 10,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                            }}
                        >
                            <Lucide name={"shield-alert"} size={20} color={"red"} />
                            <View
                                style={{
                                    flex: 1,
                                }}
                            >
                                <Text
                                    style={[{
                                        fontSize: 16,
                                        flex: 1,
                                        marginLeft: 10,
                                        color: 'red'
                                    }, globalStyles.fontSemiBold]}
                                >
                                    Crash App
                                </Text>
                                <Text
                                    style={[{
                                        fontSize: 14,
                                        paddingBottom: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                                        flex: 1,
                                        marginLeft: 10,
                                        color: colors.darkGray
                                    }, globalStyles.fontRegular]}
                                >
                                    Forces a native crash to test Crashlytics.
                                </Text>
                            </View>
                            <View
                                style={{
                                    padding: 5,
                                    height: 30,
                                    width: 30,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: colors.pageBG,
                                    borderRadius: '50%',
                                }}
                            >
                                <Lucide name={'chevron-right'} size={20} color={colors.darkPurple} />
                            </View>
                        </TouchableOpacity>
                        )}
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-evenly',
                                alignItems: 'center',
                                marginTop: 30
                            }}
                        >
                            <Text
                                onPress={() => Linking.openURL('https://vivamama.in/terms-and-conditions/')}
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkPurple,
                                    fontWeight: 600
                                }, globalStyles.fontSemiBold]}
                            >
                                {t('profile.termsOfUse')}
                            </Text>

                            <Text
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkGray,
                                    fontWeight: 600
                                }, globalStyles.fontRegular]}
                            >
                                {t('profile.appVersion')}: 1.0.0
                            </Text>

                            <Text
                                onPress={() => Linking.openURL('https://vivamama.in/privacy-policy/')}
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkPurple,
                                    fontWeight: 600
                                }, globalStyles.fontSemiBold]}
                            >
                                {t('profile.privacyPolicy')}
                            </Text>
                        </View>


                        <View
                            style={{
                                alignItems: "center"
                            }}
                        >
                            <Image
                                source={require("../public/assets/images/viva_logo.png")}
                                style={{ height: 200, objectFit: 'contain' }}
                            />
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    )
}

export default MyProfile
