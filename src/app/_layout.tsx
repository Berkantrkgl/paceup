import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import "fast-text-encoding";
import React, { useContext, useEffect } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";

// Navigasyon Mantığını İçeren Alt Bileşen
function RootLayoutNav() {
  const { isReady } = useContext(AuthContext);
  const { colors } = useTheme();

  // 1. Uygulama "Hazır" olana kadar (Token kontrolü bitene kadar) SADECE Loading göster.
  // Bu sayede kullanıcı asla anlık olarak Home veya Login ekranını yanlışlıkla görmez.
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <Image
          source={require("@/assets/images/splash-icon.png")}
          style={{ width: 120, height: 120, marginBottom: 24 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // 2. Hazır olduğunda Stack'i render et.
  // AuthContext içindeki useEffect zaten doğru sayfaya yönlendirmeyi yapacak.
  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="(protected)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="register"
        options={{
          animation: "slide_from_right",
          animationDuration: 250,
        }}
      />
    </Stack>
  );
}

// StatusBar + Android navigation bar'ı temaya bağlar.
// ThemeProvider'ın içinde yaşamalı çünkü useTheme()'e ihtiyaç duyar.
function ThemedShell() {
  const { isDark, colors } = useTheme();

  useEffect(() => {
    // Android nav bar + root view backgroundColor — iOS'ta no-op.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <>
      <StatusBar
        style={isDark ? "light" : "dark"}
        translucent={false}
        backgroundColor={
          Platform.OS === "android" ? colors.background : undefined
        }
      />
      <RootLayoutNav />
    </>
  );
}

// Ana Layout Bileşeni
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
