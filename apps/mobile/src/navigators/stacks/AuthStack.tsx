import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Landing from "../../screens/Landing";
import LoginwithPhone from "../../screens/LoginwithPhone";
import { globalStyles } from "../../public/styles";
import { colors } from "../../public/assets/colors";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator
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