import { COLORS } from "@/constants/Colors";
import { AuthContext, AuthProvider } from "@/utils/authContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "fast-text-encoding";
import React, { useContext } from "react";
import { ActivityIndicator, View } from "react-native";

// Navigasyon Mantığını İçeren Alt Bileşen
function RootLayoutNav() {
  const { isReady } = useContext(AuthContext);

  // 1. Uygulama "Hazır" olana kadar (Token kontrolü bitene kadar) SADECE Loading göster.
  // Bu sayede kullanıcı asla anlık olarak Home veya Login ekranını yanlışlıkla görmez.
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
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

// Ana Layout Bileşeni
export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar
        style="light" // Dark mode için light (beyaz yazı)
        translucent={false}
        backgroundColor={COLORS.background}
      />
      <RootLayoutNav />
    </AuthProvider>
  );
}
