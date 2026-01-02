import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging'
import Lucide from '@react-native-vector-icons/lucide'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import Toast from 'react-native-toast-message'
import { getUserContents } from '../api/getUserContents'
import { getUserProducts } from '../api/getUserProducts'
import { ArticleCard } from '../components/ArticleCard'
import DashboardMotherTab from '../components/dashboard/DashboardMotherTab'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import ItemProduct from '../components/products/ItemProduct'
import { useAuth } from '../context/AuthContext'
import { chatDB } from '../db/sqlite'
import { syncUserData } from '../utils/syncUserData'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import { IUserContent, IUserContentresponse } from '../types/content.types'
import { IUserAllData } from '../types/dashboard.types'
import { IUserProduct, IUserProductResponse } from '../types/product.types'

const Dashboard = () => {
    const navigation = useNavigation<any>();
    const [vivaScore, setVivaScore] = useState<string | null>(null);
    const [userData, setUserdata] = useState<IUserAllData>();
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const [productsData, setProductsData] = useState<IUserProduct[]>([]);
    const { userId, userToken } = useAuth();

    useFocusEffect(
        useCallback(() => {
            if (!userId) return;
            (async () => {
                try {
                    console.log("test21")

                    let getUserDataFromSQLite = await chatDB.getUserData(userId as string);

                    // Fallback: If no data in SQLite, try to sync from API
                    if (!getUserDataFromSQLite && userToken) {
                        console.log("[DASHBOARD] No local data, attempting fallback sync...");
                        await syncUserData(userToken);
                        getUserDataFromSQLite = await chatDB.getUserData(userId as string);
                    }

                    console.log("getUserDataFromSQLite in Dashboard.tsx ==>> ", getUserDataFromSQLite);
                    if (getUserDataFromSQLite) {
                        setUserdata(getUserDataFromSQLite.data);
                    }

                    const getContents: IUserContentresponse = await getUserContents();
                    setUserContentsData(getContents.data);

                    const getProducts: IUserProductResponse = await getUserProducts();
                    setProductsData(getProducts.data);
                } catch (error) {
                    console.error("Error loading dashboard data:", error);
                }
            })()
        }, [userId, userToken]))

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
            style={{ flex: 1, position: 'relative', backgroundColor: colors.white }}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: colors.white }}
            >
                <View
                    style={[globalStyles.container, { flex: 1, backgroundColor: colors.white }]}
                >
                    <View
                    >

                        <DashboardMotherTab userData={userData as IUserAllData} score={Number(vivaScore)} />

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
                                            title='See all Contents'
                                            onPress={() => navigation.navigate("Content")}
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
                                        Suggested Products
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
                                            title='See More'
                                            onPress={() => navigation.navigate("Products")}
                                        />
                                    </View>
                                </View>
                            )
                        }
                    </View>
                </View>
            </ScrollView>
            <TouchableOpacity
                onPress={() => navigation.navigate("Experts")}
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
                    Expert
                </Text>
            </TouchableOpacity>
        </View>
    )
}

export default Dashboard;