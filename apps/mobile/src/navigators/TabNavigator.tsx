import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Dashboard from '../screens/Dashboard';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { colors } from '../public/assets/colors';
import ArticleContent from '../screens/ArticleContent';
import LinearGradient from 'react-native-linear-gradient';

const Tab = createBottomTabNavigator();

export const DashboardTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarBackground: () => (
                    <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1 }}
                    />
                ),
                tabBarLabelStyle: {
                    fontSize: 12,
                },
                tabBarStyle: {
                    height: 65,
                    paddingBottom: 8,
                    paddingTop: 8,
                    paddingLeft: 8,
                    paddingRight: 8,

                },
                tabBarItemStyle: {
                    borderRadius: 100,
                },
                tabBarActiveTintColor: colors.secondary,
                tabBarInactiveTintColor: colors.white,
                tabBarActiveBackgroundColor: colors.white,
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
                name="Expert"
                component={ArticleContent}
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
                component={ArticleContent}
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