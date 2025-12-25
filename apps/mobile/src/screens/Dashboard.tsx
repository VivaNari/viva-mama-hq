import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import Toast from 'react-native-toast-message'
import { getUserContents } from '../api/getUserContents'
import { getUserProducts } from '../api/getUserProducts'
import { ArticleCard } from '../components/ArticleCard'
import DashboardCard from '../components/dashboard/DashboardCard'
import DashboardInfantTab from '../components/dashboard/DashboardInfantTab'
import DashboardMotherTab from '../components/dashboard/DashboardMotherTab'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { useAuth } from '../context/AuthContext'
import { chatDB } from '../db/sqlite'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IUserContent, IUserContentresponse } from '../types/content.types'
import { IUserAllData } from '../types/dashboard.types'
import { IUserProduct, IUserProductResponse } from '../types/product.types'
import { FLProductItem } from './Products'

const Dashboard = () => {
    const navigation = useNavigation<any>();
    const [isMotherTab, setIsMotherTab] = useState<boolean>(true)
    const [vivaScore, setVivaScore] = useState<string | null>(null);
    const [userData, setUserdata] = useState<IUserAllData>();
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const [productsData, setProductsData] = useState<IUserProduct[]>([]);
    const { userId } = useAuth();

    useEffect(() => {
        (async () => {
            const getUserDataFromSQLite = await chatDB.getUserData(userId as string);
            setUserdata(getUserDataFromSQLite.data);

            const getContents: IUserContentresponse = await getUserContents();
            setUserContentsData(getContents.data);

            const getProducts: IUserProductResponse = await getUserProducts();
            setProductsData(getProducts.data);
        })()
    }, [userId])

    useEffect(() => {
        (async function () {
            // forground message received
            messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
                console.log("remoteMessage.data inside Dashboard.tsx ==>> ", remoteMessage.data);
                setVivaScore(remoteMessage.data?.score as string);
                Toast.show({
                    type: 'success',
                    text1: remoteMessage.notification?.title,
                    text2: remoteMessage.notification?.body,
                    position: 'bottom'
                });
            });
        })()
    }, [])

    const username = userData?.user.onboarding_data.preferred_name ?
        userData.user.onboarding_data.preferred_name.split(" ")[0] :
        'User';
    useEffect(() => {
        navigation.setOptions({
            headerTitle: `Hi, ${username}`,
        });
    }, [navigation, username]);

    return (
        <View
            style={{ flex: 1, position: 'relative', backgroundColor: "blue" }}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: "yellow" }}
            >
                <View
                    style={[globalStyles.container, { flex: 1 }]}
                >
                    {/* Tabs View */}
                    <View
                        style={{
                            backgroundColor: isMotherTab ? 'rgba(238, 230, 255, 1)' : 'rgba(233, 245, 255, 1)',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            borderRadius: 30,
                            padding: 4,
                            gap: 5,
                            boxShadow: '0 0 12.8px 0 rgba(0, 0, 0, 0.25)',
                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsMotherTab(true)}
                            style={{
                                paddingHorizontal: 15,
                                flex: 1,
                                paddingVertical: 5,
                                backgroundColor: isMotherTab ? colors.subscriptionTabActiveBG : 'transparent',
                                borderRadius: 30

                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 18,
                                    textAlign: 'center',
                                    color: isMotherTab ? colors.white : colors.black,
                                }, isMotherTab ? globalStyles.fontSemiBold : globalStyles.fontRegular]}
                            >
                                Mother
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsMotherTab(false)}
                            style={{
                                paddingHorizontal: 15,
                                flex: 1,
                                paddingVertical: 5,
                                backgroundColor: !isMotherTab ? colors.primary : 'transparent',
                                borderRadius: 30
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 18,
                                    textAlign: 'center',
                                    color: !isMotherTab ? colors.white : colors.black
                                }, !isMotherTab ? globalStyles.fontSemiBold : globalStyles.fontRegular]}
                            >
                                Infant
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content View */}
                    <View
                        style={{
                            marginTop: 15
                        }}
                    >
                        {
                            isMotherTab ? (
                                <DashboardMotherTab userData={userData as IUserAllData} score={Number(vivaScore)} />
                            ) : (
                                <DashboardInfantTab />
                            )
                        }
                    </View>

                    {/* View to show at every tab */}
                    <View
                    >
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
                                    alignItems: 'flex-end',
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
                                    title='See More'
                                    onPress={() => navigation.navigate("Community")}
                                />
                            </View>
                        </View>

                        <DashboardCard
                            style={{
                                marginTop: 30
                            }}
                        >
                            <Text
                                style={[{
                                    fontSize: 20
                                }, globalStyles.fontBold]}
                            >
                                Suggested Products
                            </Text>
                            <FlatList
                                data={productsData.slice(0, 6)}
                                renderItem={FLProductItem}
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
                                    title='See More'
                                    onPress={() => navigation.navigate("Products")}
                                />
                            </View>
                        </DashboardCard>
                    </View>
                </View>
            </ScrollView>
            <LinearGradient
                onTouchEnd={() => navigation.navigate("Experts")}
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                onMagicTap={() => { }}
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
                }}
            >
                <MaterialDesignIcons name='account-box-plus-outline' color={colors.white} size={22} />
                <Text
                    style={[{
                        fontSize: 10,
                        textAlign: 'center',
                        color: colors.white,
                    }, globalStyles.fontRegular]}
                >
                    Call an Expert
                </Text>
            </LinearGradient>
        </View>
    )
}

export default Dashboard