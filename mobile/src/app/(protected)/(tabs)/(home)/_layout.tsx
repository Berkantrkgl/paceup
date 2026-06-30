import { useTheme } from "@/theme/ThemeContext";
import { Stack } from "expo-router";
import React from "react";

const HomeLayout = () => {
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
          fontSize: 18,
          fontWeight: "600",
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="progress"
        options={{
          title: "İstatistikler",
          headerBackTitle: "Geri",
        }}
      />
    </Stack>
  );
};

export default HomeLayout;
