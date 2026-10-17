import { Lucide } from '@react-native-vector-icons/lucide';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import ArticleContent from '../../screens/ArticleContent';
import ChatWithVivaAI from '../../screens/ChatWithVivaAI';
import Dashboard from '../../screens/Dashboard';
import Experts from '../../screens/Experts';
import Products from '../../screens/Products';
import { useCapability } from '../../context/SubscriptionContext';
import { Capability } from '../../types/entitlements.types';

const Tab = createBottomTabNavigator();

export const DashboardTabs = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets()
    // Safe here: RootNavigator is mounted inside SubscriptionProvider.
    const productsLocked = useCapability(Capability.PRODUCTS_VIEW).locked;

    return (
        <Tab.Navigator
            screenOptions={{
                animation: "shift",
                tabBarBackground: () => (
                    <View
                        style={{
                            backgroundColor: colors.white,
                            flex: 1
                        }}
                    />
                ),
                tabBarLabelStyle: {
                    fontSize: 11,
                    marginTop: 2,
                    ...globalStyles.fontBold
                },
                tabBarStyle: {
                    height: 65 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                    paddingLeft: 8,
                    paddingRight: 8,
                    elevation: 5,
                    boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',

                },
                tabBarItemStyle: {
                    borderRadius: 10,
                    overflow: 'hidden'
                },
                tabBarActiveTintColor: colors.purple,
                tabBarInactiveTintColor: colors.gray,
                tabBarActiveBackgroundColor: colors.white,
                headerShadowVisible: false,
                headerTitleStyle: { ...globalStyles.fontBold, color: colors.darkPurple, fontSize: 20 },
                headerStyle: {
                    backgroundColor: colors.white,
                    borderBottomWidth: 1,
                    ...globalStyles.fontRegular
                },

                headerRight: () => (
                    <View
                        style={{ paddingRight: 15, flexDirection: 'row', gap: 20, alignItems: 'center' }}
                    >
                        {/* <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("Notifications")}

                        >
                            <Lucide name='bell' size={25} color={colors.darkGray} />
                        </TouchableOpacity> */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("MyProfile")}

                        >
                            <Lucide name='user-round' size={25} color={colors.darkGray} />
                        </TouchableOpacity>
                    </View>
                ),
                headerLeft: () => (
                    <View style={{
                        paddingLeft: 15,
                    }}>
                        <Image
                            source={require("../../public/assets/images/avatar_mom.png")}
                            style={{
                                height: 40,
                                width: 40,
                                objectFit: 'contain'
                            }}

                        />
                    </View>
                )
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="layout-dashboard"
                            size={25}
                            color={color}
                        />
                    ),
                    title: t('nav.tabHome')
                }}
            />
            {/* <Tab.Screen
                name="VivaAI"
                component={ChatWithVivaAI}
                options={{
                    title: "Viva AI",
                    tabBarIcon: ({ color }) => (
                        <MaterialDesignIcons
                            name="message-badge-outline"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            /> */}
            <Tab.Screen
                name="VivaAI"
                component={ChatWithVivaAI as any}

                options={{
                    title: t('nav.tabVivaAi'),
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="message-square-dot"
                            size={25}
                            color={color}
                        />
                    ),
                    headerShown: false,
                }}
                listeners={({ navigation }) => ({
                    tabPress: e => {
                        e.preventDefault();
                        navigation.navigate('ChatWithVivaAI');
                    },
                })}
            />
            <Tab.Screen
                name="Experts"
                component={Experts}
                options={{
                    title: t('nav.tabExperts'),
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="users"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            {/* Some referral programs suppress products entirely for the mothers they
                refer. The server is the enforcement — it returns an empty list — but a
                tab that only ever shows "nothing here" reads as a broken app, so the
                tab goes too.

                The conditional has to sit directly inside Tab.Navigator: wrapping it in
                a fragment breaks React Navigation's child inspection. */}
            {!productsLocked && (
                <Tab.Screen
                    name="Products"
                    component={Products}
                    options={{
                        title: t('nav.tabProducts'),
                        tabBarIcon: ({ color }) => (
                            <Lucide
                                name="shopping-cart"
                                size={25}
                                color={color}
                            />
                        ),
                    }}
                />
            )}
            <Tab.Screen
                name="Services"
                component={ArticleContent}
                options={{
                    title: t('nav.tabContents'),
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="book-open-text"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}