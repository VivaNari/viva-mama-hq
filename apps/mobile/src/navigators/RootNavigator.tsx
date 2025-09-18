
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Onboarding from '../screens/OnboardingSteps';
import { DashboardTabNavigator } from './TabNavigator';
import Landing from '../screens/Landing';
import LoginwithPhone from '../screens/LoginwithPhone';
import Products from '../screens/Products';
import ArticleContent from '../screens/ArticleContent';
import CategoryArticles from '../screens/CategoryArticles';
import SubCategoryArticles from '../screens/SubCategoryArticles';
import ArticleDetails from '../screens/ArticleDetails';

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
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Content',
                }}
                name="Content"
                component={ArticleContent}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Articles',
                }}
                name="CategoryArticles"
                component={CategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Articles',
                }}
                name="SubCategoryArticles"
                component={SubCategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Article Details',
                }}
                name="ArticleDetails"
                component={ArticleDetails}
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