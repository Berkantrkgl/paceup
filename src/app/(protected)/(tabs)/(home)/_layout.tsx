import { COLORS } from "@/constants/Colors";
import { Stack } from "expo-router";
import React from "react";

const HomeLayout = () => {
    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: COLORS.background,
                },
                headerTintColor: COLORS.text,
                headerTitleStyle: {
                    color: COLORS.text,
                    fontSize: 18,
                    fontWeight: "600",
                },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: COLORS.background },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />

            {/* YENİ EKRAN: Standart Stack Geçişi (Sağdan sola) */}
            <Stack.Screen
                name="weekly_calendar"
                options={{
                    title: "Haftalık Takvim",
                    headerBackTitle: "Geri",
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

export default HomeLayout;
