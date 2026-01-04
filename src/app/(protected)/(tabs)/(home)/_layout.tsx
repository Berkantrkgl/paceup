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
                name="home_calendar"
                options={{
                    title: "Antrenman Takvimi",
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
