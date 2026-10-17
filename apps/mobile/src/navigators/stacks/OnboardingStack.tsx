import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import ChatWithVivaAI from "../../screens/ChatWithVivaAI";
import LanguageSelection from "../../screens/LanguageSelection";
import Services from "../../screens/Subscription";
// The legacy hardcoded-plan screen is replaced by the server-driven catalog.
import SubscriptionDetails from "../../screens/Subscription";
import ReferralCode from "../../screens/ReferralCode";

const Stack = createNativeStackNavigator();

const OnboardingStack = () => {
    const { t } = useTranslation();
    const { onboardingStatus } = useAuth();
    const { hasSelectedLanguage, isLanguageReady } = useLanguage();

    // Re-entry point for someone who killed the app mid-onboarding. Points at the
    // referral step rather than the plan catalog for the same reason the questionnaire
    // now redirects there — otherwise she would never be offered the code at all.
    const onboardingInitialRoute = onboardingStatus.is_questionnaire_completed ? "ReferralCode" : "ChatWithVivaAI";

    // Wait for the saved-language read so we don't flash the wrong first screen.
    if (!isLanguageReady) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.pageBG }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // New users pick a language before onboarding so the guided chat,
    // notifications, and recommendation snapshot are localized from the start.
    const initialRoute = hasSelectedLanguage ? onboardingInitialRoute : "LanguageSelection";

    return (
        <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
                animation: "fade_from_bottom",
                statusBarAnimation: "slide",
                headerShadowVisible: false,
                headerTitleStyle: { ...globalStyles.fontBold, fontSize: 18 },
                headerStyle: {
                    backgroundColor: colors.pageBG,
                }
            }}
        >
            <Stack.Screen
                options={{ headerShown: false }}
                name="LanguageSelection"
                component={LanguageSelection}
                initialParams={{ mode: "gate", next: onboardingInitialRoute }}
            />

            <Stack.Screen
                options={{
                    headerShown: false,
                    title: "Viva AI"
                }}
                name="ChatWithVivaAI"
                component={ChatWithVivaAI as any}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                    title: "Services"
                }}
                name="Services"
                component={Services as any}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.subscriptionDetails'),
                }}
                name="SubscriptionDetails"
                component={SubscriptionDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                }}
                name="ReferralCode"
                component={ReferralCode}
            />
        </Stack.Navigator>
    );
}

export default OnboardingStack;
