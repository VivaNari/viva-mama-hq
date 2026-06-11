import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import { useAuth } from "../context/AuthContext";
import { colors } from "../public/assets/colors";

import AppStack from "./stacks/AppStack";
import AuthStack from "./stacks/AuthStack";
import OnboardingStack from "./stacks/OnboardingStack";

const Stack = createNativeStackNavigator();

interface NotificationData {
    flowSlug?: string;
    consultationId?: string;
    type?: string;
    contentId?: string;
}

export default function RootNavigator() {
    const { userToken, isLoading, isFullyOnboarded, onboardingStatus } = useAuth();
    const navigationRef = useRef<any>(null);
    const isFirstLoad = useRef(true);

    const prevAuthState = useRef({
        userToken: userToken,
        isOnboarded: isFullyOnboarded()
    });

    useEffect(() => {
        const handleNotification = (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
            console.log('[ROOT_NAVIGATOR] Handling notification:', remoteMessage);
            const { flowSlug, consultationId, type, contentId } = remoteMessage.data as unknown as NotificationData;

            if (userToken && isFullyOnboarded()) {
                if (type === 'SLEEP_LOG_REMINDER') {
                    console.log("[ROOT_NAVIGATOR] Navigating to sleep log");
                    // navigationRef.current?.navigate("AppStack", {
                    //     screen: "ChatWithVivaAI",
                    //     params: { flowSlug: 'sleep-log-v1' }
                    // });
                } else if (type === 'MOOD_LOG_REMINDER') {
                    console.log("[ROOT_NAVIGATOR] Navigating to mood log");
                    // navigationRef.current?.navigate("AppStack", {
                    //     screen: "ChatWithVivaAI",
                    //     params: { flowSlug: 'mood-log-v1' }
                    // });
                } else if (type === 'WEEKLY_CONTENT_NOTIFICATION' && contentId) {
                    console.log("[ROOT_NAVIGATOR] Navigating to article details");
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ArticleDetails",
                        params: { articleId: contentId }
                    });
                } else if (type === 'DAILY_VIVA_INTERACTION') {
                    console.log("[ROOT_NAVIGATOR] Navigating to article details");
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ChatWithVivaAI",
                    });
                } else if (flowSlug) {
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ChatWithVivaAI",
                        params: { flowSlug }
                    });
                } else if (consultationId) {
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ConsultationRating",
                        params: { consultationId }
                    });
                }
            } else {
                console.log('[ROOT_NAVIGATOR] Skipping notification redirect: User not fully onboarded');
            }
        };

        const setupNotifications = async () => {
            const initialNotification = await messaging().getInitialNotification();
            if (initialNotification) {
                console.log('[ROOT_NAVIGATOR] Initial notification found:', initialNotification);
                setTimeout(() => handleNotification(initialNotification), 500);
            }

            const unsubscribeOnOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
                console.log('[ROOT_NAVIGATOR] App opened from background via notification');
                handleNotification(remoteMessage);
            });

            const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
                console.log('[ROOT_NAVIGATOR] Foreground message received:', remoteMessage);

                Toast.show({
                    type: 'success',
                    text1: remoteMessage.notification?.title || 'New Notification',
                    text2: remoteMessage.notification?.body || 'Tap to view details',
                    position: 'top',
                    autoHide: false,
                    onPress: () => {
                        handleNotification(remoteMessage);
                        Toast.hide();
                    }
                });
            });

            return () => {
                unsubscribeOnOpened();
                unsubscribeOnMessage();
            };
        };

        let unsubscribeNotifications: (() => void) | undefined;

        if (!isLoading) {
            setupNotifications().then(unsub => {
                unsubscribeNotifications = unsub;
            });
        }

        return () => {
            if (unsubscribeNotifications) unsubscribeNotifications();
        };
    }, [isLoading, userToken, isFullyOnboarded]);

    useEffect(() => {
        const currentIsOnboarded = isFullyOnboarded();

        if (isLoading) {
            prevAuthState.current = {
                userToken,
                isOnboarded: currentIsOnboarded
            };
            return;
        }

        const authStateChanged =
            prevAuthState.current.userToken !== userToken ||
            prevAuthState.current.isOnboarded !== currentIsOnboarded;

        if (isFirstLoad.current) {
            console.log("[ROOT_NAVIGATOR] First load complete, skipping initial reset");
            isFirstLoad.current = false;
            prevAuthState.current = {
                userToken,
                isOnboarded: currentIsOnboarded
            };
            return;
        }

        if (authStateChanged && navigationRef.current) {
            let targetStack = "AuthStack";
            if (userToken) {
                targetStack = currentIsOnboarded ? "AppStack" : "OnboardingStack";
            }

            console.log("[ROOT_NAVIGATOR] Auth state changed, resetting to:", targetStack);

            setTimeout(() => {
                navigationRef.current?.reset({
                    index: 0,
                    routes: [{ name: targetStack }],
                });
            }, 50);

            prevAuthState.current = {
                userToken: userToken,
                isOnboarded: currentIsOnboarded
            };
        }
    }, [isFullyOnboarded, userToken, onboardingStatus, isLoading]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    let initialRouteName = "AuthStack";
    if (userToken) {
        initialRouteName = isFullyOnboarded() ? "AppStack" : "OnboardingStack";
    }

    return (
        <NavigationContainer ref={navigationRef}>
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
        </NavigationContainer>
    );
}