import { useNavigation } from '@react-navigation/native'
import React from 'react'
import { FlatList, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { myProfileData, settingsMenu } from '../data/myProfileData'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import ProfileSettingsMenu from '../components/profile/ProfileSettingsMenu'

const MyProfile = () => {
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView style={[globalStyles.container, { flex: 1 }]}>
            <FlatList
                data={settingsMenu}
                renderItem={({ item, index }) => {
                    const isFirst = index === 0
                    const isLast = index === settingsMenu.length - 1

                    return (
                        <ProfileSettingsMenu
                            item={item}
                            navigation={navigation}
                            isFirst={isFirst}
                            isLast={isLast}
                        />
                    )
                }}
                keyExtractor={(_, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <>
                        {/* Profile Card */}
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ padding: 1, borderRadius: 10 }}
                        >
                            <View
                                style={{
                                    backgroundColor: colors.white,
                                    borderRadius: 10
                                }}
                            >
                                <ImageBackground
                                    source={require("../public/assets/images/Wave.png")}
                                    resizeMode="cover"
                                    style={{
                                        height: 180,
                                        width: '100%',
                                        justifyContent: "flex-end",
                                    }}
                                >
                                    <View style={{
                                        ...StyleSheet.absoluteFillObject,
                                        backgroundColor: "rgba(244, 244, 244, 0.4)",
                                        borderRadius: 10
                                    }} />
                                    <View
                                        style={{
                                            padding: 10,
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-start',
                                            gap: 30,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <View>
                                            <Image
                                                source={myProfileData.avatar}
                                                style={{
                                                    height: 110,
                                                    width: 110,
                                                    borderRadius: 75,
                                                    marginBottom: 10,
                                                    borderWidth: 2,
                                                    borderColor: colors.purple
                                                }}
                                            />
                                            {myProfileData.isPremium && (
                                                <TouchableOpacity
                                                    style={{
                                                        backgroundColor: colors.primary,
                                                        paddingVertical: 6,
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
                                                        Viva Premium
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View>
                                            <Text
                                                style={[{
                                                    fontSize: 16,
                                                    marginBottom: 5
                                                }, globalStyles.fontSemiBold]}
                                            >
                                                {myProfileData.name}
                                            </Text>
                                            <Text
                                                style={[{
                                                    color: 'rgba(0, 0, 0, 0.6)',
                                                    fontSize: 12,
                                                }, globalStyles.fontRegular]}
                                            >
                                                {myProfileData.email}
                                            </Text>
                                            <Text
                                                style={[{
                                                    color: 'rgba(0, 0, 0, 0.6)',
                                                    fontSize: 12,
                                                }, globalStyles.fontRegular]}
                                            >
                                                Age - {myProfileData.age}
                                            </Text>

                                            <TouchableOpacity
                                                onPress={() => navigation.navigate("EditProfile")}
                                                activeOpacity={0.7}
                                                style={{
                                                    backgroundColor: colors.secondary,
                                                    paddingVertical: 6,
                                                    borderRadius: 15,
                                                    marginTop: 10,
                                                }}
                                            >
                                                <Text style={[{
                                                    textAlign: "center",
                                                    color: colors.white,
                                                    fontSize: 10
                                                }, globalStyles.fontRegular]}>
                                                    Edit Profile
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </ImageBackground>
                            </View>
                        </LinearGradient>

                        {/* Link Your Partner */}
                        <View
                            style={{
                                backgroundColor: colors.profileOptionsBG,
                                paddingVertical: 15,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                marginVertical: 25,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <Text
                                style={[globalStyles.fontRegular]}
                            >Add Your partner</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate("AddPartner")}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: colors.primary,
                                    paddingVertical: 10,
                                    paddingHorizontal: 20,
                                    borderRadius: 15
                                }}
                            >
                                <Text
                                    style={[{
                                        color: colors.white,
                                        textAlign: 'center',
                                        fontSize: 12
                                    }, globalStyles.fontRegular]}
                                >
                                    Link Your Partner
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
                // Footer
                ListFooterComponent={() => (
                    <View
                        style={{
                            marginTop: 30,
                        }}
                    >
                        <TouchableOpacity
                            style={{
                                backgroundColor: colors.logout,
                                padding: 14,
                                borderRadius: 10
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 16,
                                    color: colors.white,
                                    textAlign: 'center'
                                }, globalStyles.fontBold]}
                            >
                                Sign Out
                            </Text>
                        </TouchableOpacity>

                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 20,
                                marginTop: 30
                            }}
                        >
                            <Text
                                onPress={() => navigation.navigate('TermsOfUse' as any)}
                                style={[{
                                    fontSize: 12,
                                    color: colors.primary,
                                    fontWeight: 600
                                }, globalStyles.fontRegular]}
                            >
                                Terms of use
                            </Text>
                            <Text
                                onPress={() => navigation.navigate('PrivacyPolicy' as any)}
                                style={[{
                                    fontSize: 12,
                                    color: colors.primary,
                                    fontWeight: 600
                                }, globalStyles.fontRegular]}
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
