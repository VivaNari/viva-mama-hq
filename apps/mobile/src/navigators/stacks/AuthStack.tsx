import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import Landing from "../../screens/Landing";
import LoginwithPhone from "../../screens/LoginwithPhone";
import WelcomeIntro from "../../screens/WelcomeIntro";
import { globalStyles } from "../../public/styles";
import { colors } from "../../public/assets/colors";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
    const { hasSeenWelcomeIntro } = useAuth();

    return (
        <Stack.Navigator
            initialRouteName={hasSeenWelcomeIntro ? "Landing" : "WelcomeIntro"}
            screenOptions={{
                animation: "fade_from_bottom",
                statusBarAnimation: "slide",
                headerShadowVisible: false,
                headerTitleStyle: { ...globalStyles.fontBold, fontSize: 18 },
                headerStyle: {
                    backgroundColor: colors.pageBG
                }

            }}
        >
            <Stack.Screen
                name="WelcomeIntro"
                component={WelcomeIntro}
                options={{
                    headerShown: false,
                }}
            />
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
        </Stack.Navigator>
    );
}

export default AuthStack;
