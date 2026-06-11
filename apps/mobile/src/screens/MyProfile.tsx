import InAppReview from 'react-native-in-app-review'
import Lucide from '@react-native-vector-icons/lucide'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import { FlatList, Image, Text, TouchableOpacity, View, Linking, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ProfileSettingsMenu from '../components/profile/ProfileSettingsMenu'
import { useAuth } from '../context/AuthContext'
import { settingsMenu } from '../data/myProfileData'
import { chatDB } from '../db/sqlite'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IUserAllData } from '../types/dashboard.types'
import { syncUserData } from '../utils/syncUserData'

const MyProfile = () => {
    const navigation = useNavigation<any>();
    const { signOut } = useAuth();
    const [getLoading, setLoading] = useState<boolean>(false);
    const [userData, setUserdata] = useState<IUserAllData>();
    const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);
    const { userId, userToken } = useAuth();

    const handleInAppReview = () => {
        // NOTE: In-App Review only shows up in Production/Internal Test Track on Play Store.
        // It will NOT show on debug builds or sideloaded APKs.
        if (InAppReview.isAvailable()) {
            InAppReview.RequestInAppReview()
                .then((hasFlowFinishedSuccessfully) => {
                    console.log('In-App Review flow finished successfully:', hasFlowFinishedSuccessfully);
                })
                .catch((error) => {
                    console.log('In-App Review Error:', error);
                    openStoreFallback();
                });
        } else {
            openStoreFallback();
        }
    };

    const openStoreFallback = () => {
        const GOOGLE_PACKAGE_NAME = 'com.wellnessemporio.vivamama';
        const url = Platform.OS === 'ios'
            ? `itms-apps://itunes.apple.com/app/viewContentsUserReviews/idYOUR_APPLE_ID?action=write-review`
            : `market://details?id=${GOOGLE_PACKAGE_NAME}`;

        Linking.openURL(url).catch(() => {
            // If play store app is not available, open in browser
            const browserUrl = `https://play.google.com/store/apps/details?id=${GOOGLE_PACKAGE_NAME}`;
            Linking.openURL(browserUrl);
        });
    };

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
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
            {/* Disclaimer Modal */}
            <Modal
                visible={showDisclaimerModal}
                transparent={true}
                animationType="fade"
            >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[globalStyles.fontBold, { fontSize: 20, color: colors.darkPurple, flex: 1 }]}>Medical Disclaimer</Text>
                            <TouchableOpacity onPress={() => setShowDisclaimerModal(false)}>
                                <Lucide name="x" size={24} color={colors.black} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            VivaMama is a postpartum wellness and education companion. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.
                        </Text>
                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            Always consult a qualified healthcare professional for medical advice, diagnosis, or treatment.
                        </Text>
                        <Text style={[globalStyles.fontRegular, { fontSize: 14, color: colors.black }]}>
                            In an emergency, contact your doctor or local emergency services immediately.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setShowDisclaimerModal(false)}
                            style={{ padding: 12, borderRadius: 30, backgroundColor: colors.darkPurple, marginTop: 10 }}
                        >
                            <Text style={[globalStyles.fontSemiBold, { textAlign: 'center', color: colors.white }]}>Close</Text>
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

                                        {
                                            userData &&
                                                (!(userData.user.subscription.expiryDate) || new Date(userData.user.subscription.expiryDate) < new Date())
                                                ? (
                                                    <TouchableOpacity
                                                        style={{
                                                            backgroundColor: colors.darkPurple,
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 10,
                                                            borderRadius: 15
                                                        }}
                                                    >
                                                        <Text
                                                            style={[{
                                                                color: colors.white,
                                                                textAlign: 'center',
                                                                fontSize: 10
                                                            }, globalStyles.fontRegular]}
                                                        >
                                                            Get Premium Today
                                                        </Text>
                                                    </TouchableOpacity>
                                                )
                                                : userData && (
                                                    <TouchableOpacity
                                                        style={{
                                                            backgroundColor: colors.darkPurple,
                                                            paddingVertical: 6,
                                                            paddingHorizontal: 10,
                                                            borderRadius: 15
                                                        }}
                                                    >
                                                        <Text
                                                            style={[{
                                                                color: colors.white,
                                                                textAlign: 'center',
                                                                fontSize: 10
                                                            }, globalStyles.fontRegular]}
                                                        >
                                                            {userData.user.subscription.plan}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )
                                        }

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
                                    Medical Disclaimer
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
                                    Important health and usage information
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
                        <TouchableOpacity
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
                                    Review Us
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
                                    Share your feedback and help us improve.
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
                                        getLoading ? 'Signing Out...' : 'Sign Out'
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
                                    Signout from your current session
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
                                Terms of use
                            </Text>

                            <Text
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkGray,
                                    fontWeight: 600
                                }, globalStyles.fontRegular]}
                            >
                                App Version: 1.0.0
                            </Text>

                            <Text
                                onPress={() => Linking.openURL('https://vivamama.in/privacy-policy/')}
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkPurple,
                                    fontWeight: 600
                                }, globalStyles.fontSemiBold]}
                            >
                                Privacy Policy
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
