// RootNavigator.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors } from "../public/assets/colors";

import AppStack from "./stacks/AppStack";
import AuthStack from "./stacks/AuthStack";
import OnboardingStack from "./stacks/OnboardingStack";
import { BottomSheetProvider } from "../components/bottomSheet/AppBottomSheet";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { userToken, isLoading, isFullyOnboarded, onboardingStatus } = useAuth();
    const navigationRef = useRef<any>(null);

    // Track previous auth state to detect changes
    const prevAuthState = useRef({
        userToken: userToken,
        isOnboarded: isFullyOnboarded()
    });

    useEffect(() => {
        // Only reset navigation if auth state actually changed
        const currentIsOnboarded = isFullyOnboarded();
        const authStateChanged =
            prevAuthState.current.userToken !== userToken ||
            prevAuthState.current.isOnboarded !== currentIsOnboarded;

        if (!isLoading && authStateChanged && navigationRef.current) {
            // Determine target stack
            let targetStack = "AuthStack";
            if (userToken) {
                targetStack = currentIsOnboarded ? "AppStack" : "OnboardingStack";
            }

            console.log("[ROOT_NAVIGATOR] Auth state changed, navigating to:", targetStack);

            // Reset navigation to the appropriate stack
            setTimeout(() => {
                navigationRef.current?.reset({
                    index: 0,
                    routes: [{ name: targetStack }],
                });
            }, 50);

            // Update previous state
            prevAuthState.current = {
                userToken: userToken,
                isOnboarded: currentIsOnboarded
            };
        }
    }, [isFullyOnboarded, userToken, onboardingStatus.is_questionnaire_completed, onboardingStatus.is_subscription_completed, isLoading]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Determine initial route
    let initialRouteName = "AuthStack";
    if (userToken) {
        initialRouteName = isFullyOnboarded() ? "AppStack" : "OnboardingStack";
    }

    return (
        <NavigationContainer ref={navigationRef}>
            <BottomSheetProvider>

                <Stack.Navigator
                    initialRouteName={initialRouteName}
                    screenOptions={{
                        headerShown: false,
                        animation: "fade"
                    }}
                >
                    <Stack.Screen name="AuthStack" component={AuthStack} />
                    <Stack.Screen name="OnboardingStack" component={OnboardingStack} />
                    <Stack.Screen name="AppStack" component={AppStack} />
                </Stack.Navigator>
            </BottomSheetProvider>
        </NavigationContainer>
    );
}