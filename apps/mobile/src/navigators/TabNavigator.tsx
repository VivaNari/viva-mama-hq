import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Image, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../public/assets/colors';
import ArticleContent from '../screens/ArticleContent';
import Dashboard from '../screens/Dashboard';
import Experts from '../screens/Experts';
import Services from '../screens/Services';
import { globalStyles } from '../public/styles';

const Tab = createBottomTabNavigator();

export const DashboardTabNavigator = () => {
    const navigation = useNavigation<any>();
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
                    height: 65,
                    paddingBottom: 8,
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
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialDesignIcons
                            name="view-dashboard-outline"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Viva AI"
                component={ArticleContent}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialDesignIcons
                            name="message-badge-outline"
                            size={25}
                            color={color}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Experts"
                component={Experts}
                options={{
                    tabBarIcon: ({ color, focused }) => (
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
                    tabBarIcon: ({ color, focused }) => (
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
                    tabBarIcon: ({ color, focused }) => (
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