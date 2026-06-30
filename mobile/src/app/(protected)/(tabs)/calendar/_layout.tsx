import { useTheme } from "@/theme/ThemeContext";
import { Stack } from "expo-router";
import React from "react";

const _layout = () => {
    const { colors } = useTheme();
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
                name="index"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="workout-detail"
                options={{
                    headerShown: false,
                    presentation: "modal",
                }}
            />
        </Stack>
    );
};

export default _layout;
