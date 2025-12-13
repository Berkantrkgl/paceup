import { COLORS } from "@/constants/Colors";
import { Stack } from "expo-router";
import React from "react";

const _layout = () => {
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: COLORS.background,
                },
                headerTintColor: COLORS.text,
                headerTitleStyle: {
                    color: COLORS.text,
                    fontSize: 20,
                    fontWeight: "600",
                },
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: "Home",
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name="progress"
                options={{
                    title: "İlerlemem",
                    headerBackTitle: "Geri",
                }}
            />
        </Stack>
    );
};

export default _layout;
