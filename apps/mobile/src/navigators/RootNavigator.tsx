import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import { useAuth } from "../context/AuthContext";
import { colors } from "../public/assets/colors";
import { AnalyticsEvent, track, trackScreen } from "../analytics";
import type { NotificationSource } from "../analytics";

import PaywallSheet from "../components/subscriptions/PaywallSheet";
import AppStack from "./stacks/AppStack";
import AuthStack from "./stacks/AuthStack";
import OnboardingStack from "./stacks/OnboardingStack";

const Stack = createNativeStackNavigator();

interface NotificationData {
    flowSlug?: string;
    consultationId?: string;
    type?: string;
    contentId?: string;
    /** Which pre-call reminder this is: "60" or "15" minutes before the call. */
    minutesBefore?: string;
}

export default function RootNavigator() {
    const { userToken, isLoading, isFullyOnboarded, onboardingStatus, pendingRedirect, setPendingRedirect } = useAuth();
    const navigationRef = useRef<any>(null);
    const isFirstLoad = useRef(true);
    // Last screen reported to Analytics, so a state change that doesn't actually
    // move the user (params updating, a tab re-render) doesn't log a duplicate.
    const currentScreenRef = useRef<string | null>(null);

    const prevAuthState = useRef({
        userToken: userToken,
        isOnboarded: isFullyOnboarded()
    });

    useEffect(() => {
        const handleNotification = (
            remoteMessage: FirebaseMessagingTypes.RemoteMessage,
            source: NotificationSource,
        ) => {
            console.log('[ROOT_NAVIGATOR] Handling notification:', remoteMessage);
            const { flowSlug, consultationId, type, contentId } = remoteMessage.data as unknown as NotificationData;

            // Logged before the onboarding gate below, so pushes that land on a
            // user who cannot act on them are still visible in the funnel — that
            // gap is exactly the kind of thing worth seeing.
            track(AnalyticsEvent.NOTIFICATION_OPENED, {
                notification_type: type ?? flowSlug ?? 'unknown',
                source,
            });

            if (userToken && isFullyOnboarded()) {
                if (type === 'SLEEP_LOG_REMINDER') {
                    console.log("[ROOT_NAVIGATOR] Navigating to sleep log");
                    // navigationRef.current?.navigate("AppStack", {
                    //     screen: "ChatWithVivaAI",
                    //     params: { flowSlug: 'sleep-log-v1' }
                    // });
                } else if (type === 'MOOD_LOG_REMINDER') {
                    console.log("[ROOT_NAVIGATOR] Navigating to mood log");
                    navigationRef.current?.navigate("AppStack", {
                        screen: "MoodLog",
                    });
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
                } else if (type === "SUBSCRIPTION_REMINDER") {
                    navigationRef.current?.navigate("AppStack", {
                        screen: "SubscriptionDetails",
                    });
                } else if (type === "CONSULTATION_COMPLETED" && consultationId) {
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ConsultationRating",
                        params: { consultationId }
                    });
                } else if (type === "CONSULTATION_REMINDER" || type === "CONSULTATION_TIME_CONFIRMED") {
                    // The dashboard is where the consultation banner and its Join button
                    // live, so the reminder lands on the one screen that can act on it.
                    console.log("[ROOT_NAVIGATOR] Navigating to the consultation banner");
                    navigationRef.current?.navigate("AppStack", {
                        screen: "DashboardTabNavigator",
                    });
                } else if (flowSlug) {
                    // Deliberately last: this is the catch-all for chat flows, and every
                    // typed branch above must get its chance first. It used to sit above
                    // CONSULTATION_COMPLETED, which meant any consultation push that also
                    // carried a flowSlug was swallowed into the chat screen.
                    navigationRef.current?.navigate("AppStack", {
                        screen: "ChatWithVivaAI",
                        params: { flowSlug }
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
                setTimeout(() => handleNotification(initialNotification, 'cold'), 500);
            }

            const unsubscribeOnOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
                console.log('[ROOT_NAVIGATOR] App opened from background via notification');
                handleNotification(remoteMessage, 'background');
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
                        handleNotification(remoteMessage, 'foreground');
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

            // Capture any one-shot deep-link intent (e.g. a bereaved user routed to
            // expert/AI support) so we can honour it AFTER the stack reset settles.
            const redirect = targetStack === "AppStack" ? pendingRedirect : null;
            if (redirect) {
                setPendingRedirect(null);
            }

            setTimeout(() => {
                navigationRef.current?.reset({
                    index: 0,
                    routes: [{ name: targetStack }],
                });

                if (redirect) {
                    // Navigate after the reset has mounted AppStack so it isn't stomped.
                    setTimeout(() => {
                        if (redirect === "experts") {
                            navigationRef.current?.navigate("AppStack", {
                                screen: "DashboardTabNavigator",
                                params: { screen: "Experts" },
                            });
                        } else if (redirect === "aiChat") {
                            navigationRef.current?.navigate("AppStack", {
                                screen: "ChatWithVivaAI",
                            });
                        }
                    }, 200);
                }
            }, 50);

            prevAuthState.current = {
                userToken: userToken,
                isOnboarded: currentIsOnboarded
            };
        }
    }, [isFullyOnboarded, userToken, onboardingStatus, isLoading, pendingRedirect, setPendingRedirect]);

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

    /**
     * One screen_view for the whole app.
     *
     * `getCurrentRoute()` resolves through nested navigators to the route the user
     * is actually looking at, so this covers every screen in AppStack, AuthStack,
     * OnboardingStack and the dashboard tabs — including screens added later —
     * without any per-screen listener. It also pins `current_screen` onto crash
     * reports, via trackScreen.
     */
    const handleNavigationStateChange = () => {
        const routeName = navigationRef.current?.getCurrentRoute()?.name;
        if (!routeName || routeName === currentScreenRef.current) return;

        currentScreenRef.current = routeName;
        trackScreen(routeName);
    };

    return (
        <NavigationContainer
            ref={navigationRef}
            onReady={handleNavigationStateChange}
            onStateChange={handleNavigationStateChange}
        >
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

            {/* Mounted once, above every screen: a 402 from any request opens it, so
                each screen does not need its own paywall handling. Navigation goes
                through the same navigationRef the notification handlers use — the
                sheet sits outside the navigator and cannot call useNavigation. */}
            <PaywallSheet
                onSeePlans={() =>
                    navigationRef.current?.navigate("AppStack", {
                        screen: "SubscriptionDetails",
                    })
                }
            />
        </NavigationContainer>
    );
}