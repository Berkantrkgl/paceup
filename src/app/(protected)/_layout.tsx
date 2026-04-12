import { useTheme } from "@/theme/ThemeContext";
import { AuthContext } from "@/utils/authContext";
import { Redirect, Stack } from "expo-router";
import React, { useContext } from "react";

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);
    const { colors } = useTheme();

    if (!authState.isReady) {
        return null;
    }

    if (!authState.isLoggedIn) {
        console.log(authState.isLoggedIn);
        return <Redirect href={"/login"} />;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    color: colors.text.primary,
                    fontSize: 20,
                    fontWeight: "600",
                },
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="(tabs)"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="premium"
                options={{
                    presentation: "modal",
                    headerShown: false,
                }}
            />
        </Stack>
    );
}
