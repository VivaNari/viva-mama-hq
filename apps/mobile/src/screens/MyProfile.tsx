import { useNavigation } from '@react-navigation/native'
import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ProfileSettingsMenu from '../components/profile/ProfileSettingsMenu'
import { useAuth } from '../context/AuthContext'
import { myProfileData, settingsMenu } from '../data/myProfileData'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import Lucide from '@react-native-vector-icons/lucide'

const MyProfile = () => {
    const navigation = useNavigation<any>();
    const { signOut } = useAuth();
    const [getLoading, setLoading] = useState<boolean>(false);
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
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
                                        source={myProfileData.avatar}
                                        style={{
                                            height: 70,
                                            width: 70,
                                            borderRadius: 75,
                                            borderWidth: 2,
                                            borderColor: colors.purple,
                                        }}
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
                                            {myProfileData.name}
                                        </Text>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: colors.darkPurple,
                                                paddingVertical: 6,
                                                paddingHorizontal: 5,
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
                        style={[{
                            marginTop: 20,
                        }, globalStyles.container]}
                    >
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: colors.logout,
                                padding: 14,
                                borderRadius: 10,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 10
                            }}
                            onPress={() => {
                                setLoading(true);
                                setTimeout(() => {
                                    signOut()
                                    setLoading(false);
                                }, 500);
                            }}
                        >
                            {
                                getLoading && <ActivityIndicator />
                            }
                            <Text
                                style={[{
                                    fontSize: 16,
                                    color: colors.white,
                                    textAlign: 'center'
                                }, globalStyles.fontBold]}
                            >
                                {
                                    getLoading ? 'Signing Out...' : 'Sign Out'
                                }
                            </Text>
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
                                onPress={() => navigation.navigate('TermsOfUse' as any)}
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkPurple,
                                    fontWeight: 600
                                }, globalStyles.fontSemiBold]}
                            >
                                Terms of use
                            </Text>

                            <Text
                                onPress={() => navigation.navigate('TermsOfUse' as any)}
                                style={[{
                                    fontSize: 12,
                                    color: colors.darkGray,
                                    fontWeight: 600
                                }, globalStyles.fontRegular]}
                            >
                                App Version: 1.0.0
                            </Text>

                            <Text
                                onPress={() => navigation.navigate('PrivacyPolicy' as any)}
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
