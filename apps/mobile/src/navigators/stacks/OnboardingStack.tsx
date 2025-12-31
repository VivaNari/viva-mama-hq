import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { useAuth } from "../../context/AuthContext";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import ChatWithVivaAI from "../../screens/ChatWithVivaAI";
import Services from "../../screens/Subscription";
import SubscriptionDetails from "../../components/SubscriptionDetails";

const Stack = createNativeStackNavigator();

const OnboardingStack = () => {
    const { onboardingStatus } = useAuth();

    const initialRoute = onboardingStatus.is_questionnaire_completed ? "Services" : "ChatWithVivaAI";
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
                    title: 'Subscription Details',
                }}
                name="SubscriptionDetails"
                component={SubscriptionDetails}
            />
        </Stack.Navigator>
    );
}

export default OnboardingStack;
