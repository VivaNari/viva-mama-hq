import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Image, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import ArticleContent from '../screens/ArticleContent';
import ChatWithVivaAI from '../screens/ChatWithVivaAI';
import Dashboard from '../screens/Dashboard';
import Experts from '../screens/Experts';
import Services from '../screens/Services';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

export const DashboardTabNavigator = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={{
                animation: "shift",
                tabBarBackground: () => (
                    <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1 }}
                    />
                ),
                tabBarLabelStyle: {
                    fontSize: 8,
                    marginTop: 2,
                    ...globalStyles.fontRegular
                },
                tabBarStyle: {
                    height: 65 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 8,
                    paddingLeft: 8,
                    paddingRight: 8,

                },
                tabBarItemStyle: {
                    borderRadius: 10,
                    overflow: 'hidden'
                },
                tabBarActiveTintColor: colors.secondary,
                tabBarInactiveTintColor: colors.white,
                tabBarActiveBackgroundColor: colors.white,
                headerShadowVisible: false,
                headerTitleStyle: { ...globalStyles.fontBold },
                headerStyle: {
                    backgroundColor: colors.pageBG
                },

                headerRight: () => (
                    <View
                        style={{ paddingRight: 15, flexDirection: 'row', gap: 20, alignItems: 'center' }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("Notifications")}

                        >
                            <MaterialDesignIcons name='bell-outline' size={30} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("MyProfile")}
                            style={{
                                borderWidth: 2,
                                padding: 2,
                                borderRadius: 8,
                                borderColor: colors.primary
                            }}
                        >
                            <Image
                                source={require('../public/assets/images/doctors/Dr_Harsha_Tomar.png')}
                                style={{ height: 40, width: 40, borderRadius: 8 }}
                            />
                        </TouchableOpacity>
                    </View>
                )
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialDesignIcons
                            name="view-dashboard-outline"
                            size={25}
                            color={color}
                        />
                    ),
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
                        <MaterialDesignIcons
                            name="account-box-outline"
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
                    tabBarIcon: ({ color }) => (
                        <MaterialDesignIcons
                            name="book-open-blank-variant-outline"
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
                    tabBarIcon: ({ color }) => (
                        <MaterialDesignIcons
                            name="scatter-plot"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}