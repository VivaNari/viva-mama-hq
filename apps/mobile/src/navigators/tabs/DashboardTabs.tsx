import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Lucide } from '@react-native-vector-icons/lucide';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useCounterContext } from '../../context/CounterContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import ArticleContent from '../../screens/ArticleContent';
import ChatWithVivaAI from '../../screens/ChatWithVivaAI';
import Dashboard from '../../screens/Dashboard';
import Experts from '../../screens/Experts';
import Services from '../../screens/Subscription';

const Tab = createBottomTabNavigator();

interface NotificationData {
    flowSlug: string;
    conversationId: string;
}

export const DashboardTabs = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { counter, increase } = useCounterContext();

    useEffect(() => {
        (async function () {
            // forground message received
            const unsubscribe = messaging().onMessage(async remoteMessage => {

                if (remoteMessage.data && remoteMessage.data.uiElements) {
                    const uiElements = JSON.parse(remoteMessage.data.uiElements as string);
                    // @TODO: Now do anything with the ui elements 
                }

                Toast.show({
                    type: 'success',
                    text1: remoteMessage.notification?.title,
                    text2: remoteMessage.notification?.body,
                    position: 'top'
                });
                increase();
            });

            messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
                console.log('App opened from notification:', remoteMessage);

                const { flowSlug } = remoteMessage.data as unknown as NotificationData;

                if (true) {
                    navigation.navigate("ChatWithVivaAI" as never, {
                        flowSlug
                    });
                }
            });

            return unsubscribe;
        })();
    }, [navigation, increase])

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
                headerTitleStyle: { ...globalStyles.fontBold, color: colors.purple, fontSize: 20 },
                headerStyle: {
                    backgroundColor: colors.white,
                    borderBottomWidth: 1,
                    ...globalStyles.fontRegular
                },

                headerRight: () => (
                    <View
                        style={{ paddingRight: 15, flexDirection: 'row', gap: 20, alignItems: 'center' }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("Notifications")}

                        >
                            <Lucide name='bell' size={25} color={colors.darkGray} />
                        </TouchableOpacity>
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
                            source={require("../../public/assets/images/viva_logo_icon.png")}
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
                    title: "Home"
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
                    title: "Viva AI",
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="message-square-dot"
                            size={25}
                            color={color}
                        />
                    ),
                    tabBarBadge: counter > 0 ? counter : undefined,
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
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="users"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Community"
                component={ArticleContent}
                options={{
                    title: "Products",
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="shopping-cart"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Services"
                component={Services}
                options={{
                    title: "Contents",
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