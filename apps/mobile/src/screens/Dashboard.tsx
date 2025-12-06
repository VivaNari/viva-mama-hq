import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../public/assets/colors'
import { globalStyles } from '../public/styles'
import DashboardMotherTab from '../components/dashboard/DashboardMotherTab'
import DashboardInfantTab from '../components/dashboard/DashboardInfantTab'
import { contentsData } from '../data/contentsData'
import { ICategory } from '../types/content.types'
import FLCategoryItem from '../components/community/FLCategoryItem'
import FLSubCategoryItem from '../components/community/FLSubCategoryItem'
import DashboardCard from '../components/dashboard/DashboardCard'
import { ArticleCard } from '../components/ArticleCard'
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius'
import { productData } from '../data/productsData'
import { FLProductItem } from './Products'
import { IProduct } from '../types/product.types'
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons'
import LinearGradient from 'react-native-linear-gradient'
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message'

const Dashboard = () => {
    const navigation = useNavigation<any>();
    const [isMotherTab, setIsMotherTab] = useState<boolean>(true)
    const [vivaScore, setVivaScore] = useState<string | null>(null);
    useEffect(() => {
        (async function () {
            // forground message received
            const unsubscribe = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
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


    const username = "Harshaa";
    useEffect(() => {
        navigation.setOptions({
            headerTitle: `Hi, ${username}`,
        });
    }, [navigation, username]);
    const allArticles = contentsData.flatMap(category =>
        category.subCategories.flatMap(subCategory => subCategory.contents)
    );

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
                                <DashboardMotherTab score={vivaScore} />
                            ) : (
                                <DashboardInfantTab />
                            )
                        }
                    </View>

                    {/* View to show at every tab */}
                    <View>
                        <DashboardCard>
                            <Text
                                style={[{
                                    fontSize: 20
                                }, globalStyles.fontBold]}
                            >
                                Content section
                            </Text>
                            <FlatList
                                data={allArticles.slice(0, 3)}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <ArticleCard
                                        key={item.id.toString()}
                                        item={item}
                                    />
                                )}
                                scrollEnabled={false}
                                nestedScrollEnabled={false}
                                ListHeaderComponent={
                                    <FlatList
                                        keyExtractor={(item: ICategory) => item.id.toString()}
                                        data={contentsData}
                                        renderItem={({ item }) => FLCategoryItem({ item, navigation })}
                                        numColumns={3}
                                        columnWrapperStyle={{
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-end',
                                            flexWrap: 'wrap',
                                        }}
                                        style={{ paddingHorizontal: 30, marginBottom: 20 }}
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
                        </DashboardCard>

                        <DashboardCard>
                            <Text
                                style={[{
                                    fontSize: 20
                                }, globalStyles.fontBold]}
                            >
                                Suggested Products
                            </Text>
                            <FlatList
                                data={productData.slice(0, 6)}
                                renderItem={FLProductItem}
                                keyExtractor={(item: IProduct, index: number) => index.toString()}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 2, marginBottom: 20, justifyContent: 'space-between' }}
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