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
                name="plan_details"
                options={{
                    title: "Plan Detayı",
                    headerBackTitle: "Geri",
                }}
            />

            <Stack.Screen
                name="chatbot"
                options={{
                    title: "AI Koşu Koçu",
                    headerBackTitle: "Geri",
                }}
            />
        </Stack>
    );
};

export default _layout;
