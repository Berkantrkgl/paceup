import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

// Aktif ikon için bounce animasyonu
const AnimatedTabIcon = ({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.2,
          useNativeDriver: true,
          speed: 40,
          bounciness: 14,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 10,
        }),
      ]).start();
    }
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
  );
};

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          height: Platform.OS === "ios" ? 96 : 72,
          borderTopWidth: 0,
          borderTopColor: "transparent",
          paddingBottom: Platform.OS === "ios" ? 34 : 12,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Takvim",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? "calendar" : "calendar-outline"}
                size={22}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: "Planlama",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name={focused ? "sparkles" : "sparkles-outline"}
                size={22}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <MaterialCommunityIcons
                name="run-fast"
                size={26}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
