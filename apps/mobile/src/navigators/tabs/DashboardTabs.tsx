import { Lucide } from '@react-native-vector-icons/lucide';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import Dashboard from '../../screens/Dashboard';
import Experts from '../../screens/Experts';
import Library from '../../screens/Library';
import VivaAIHub from '../../screens/VivaAIHub';
import VivaClubPost from '../../screens/VivaClubPost';

const Tab = createBottomTabNavigator();

export const DashboardTabs = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets()

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
            {/* Shown as Journey. The route keeps its name, so existing navigation still works. */}
            <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="map-pin"
                            size={25}
                            color={color}
                        />
                    ),
                    title: t('nav.tabJourney')
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
            {/* The tab is a hub now; chat opens from its "Ask a question" action. */}
            <Tab.Screen
                name="VivaAI"
                component={VivaAIHub}
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
            <Tab.Screen
                name="Community"
                component={VivaClubPost}
                options={{
                    title: t('nav.tabCommunity'),
                    tabBarIcon: ({ color }) => (
                        <Lucide
                            name="heart-handshake"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            {/* Not named "Services": that is the plan catalog's route in AppStack, and a tab
                with the same name would catch navigate("Services") from inside the tabs. */}
            <Tab.Screen
                name="Library"
                component={Library}
                options={{
                    title: t('nav.tabLibrary'),
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