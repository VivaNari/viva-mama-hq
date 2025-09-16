import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Dashboard from '../screens/Dashboard';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { colors } from '../public/assets/colors';

const Tab = createBottomTabNavigator();

export const DashboardTabNavigator = () => {
    return (
        <Tab.Navigator>
            <Tab.Screen
                name="Dashboard"
                component={Dashboard}
                options={{
                    tabBarIcon: () => <MaterialDesignIcons name="home" color={colors.primary} size={20} />,
                }}
            />
        </Tab.Navigator>
    );
}