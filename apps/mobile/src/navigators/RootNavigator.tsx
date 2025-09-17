
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Onboarding from '../screens/OnboardingSteps';
import { DashboardTabNavigator } from './TabNavigator';
import Landing from '../screens/Landing';
import LoginwithPhone from '../screens/LoginwithPhone';
import Products from '../screens/Products';

const Stack = createNativeStackNavigator();

const RootStack = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Landing"
                component={Landing}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="LoginWithPhone"
                component={LoginwithPhone}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="Onboarding"
                component={Onboarding}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
                name="DashboardTabNavigator"
                component={DashboardTabNavigator}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Suggested Products',
                }}
                name="Products"
                component={Products}
            />
        </Stack.Navigator>
    );
}

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <RootStack />
        </NavigationContainer>
    );
}