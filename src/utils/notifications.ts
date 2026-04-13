import { API_URL } from "@/constants/Config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PUSH_TOKEN_CACHE_KEY = "expo-push-token-v1";

/**
 * Foreground'da bildirim gelince: banner + ses + badge göster.
 * Handler'ın nerede kurulacağı: _layout.tsx veya authContext init'te bir kez.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Permission ister ve Expo push token döner.
 * Fiziksel cihaz değilse (simulator) null döner.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[notifications] Simulator — push notification desteklenmez");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF4501",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[notifications] İzin verilmedi");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[notifications] projectId bulunamadı — app.json kontrol et");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.error("[notifications] getExpoPushTokenAsync hatası:", e);
    return null;
  }
}

/**
 * Token'ı backend'e gönderir. Cache ile karşılaştırır — değişmemişse atlar.
 */
async function sendTokenToBackend(
  expoPushToken: string,
  validToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/users/register_push_token/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ push_token: expoPushToken }),
    });
    if (response.ok) {
      await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, expoPushToken);
      return true;
    }
    console.warn(
      "[notifications] Backend token kayıt hatası:",
      response.status,
    );
    return false;
  } catch (e) {
    console.error("[notifications] Backend token gönderme hatası:", e);
    return false;
  }
}

/**
 * Tam akış: permission iste → token al → backend'e gönder (cache kontrolü ile).
 * Login/register/googleSignIn sonrası çağrılır.
 */
export async function registerForPushNotifications(
  getValidToken: () => Promise<string | null>,
): Promise<string | null> {
  const expoPushToken = await getExpoPushToken();
  if (!expoPushToken) return null;

  const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
  if (cachedToken === expoPushToken) {
    console.log("[notifications] Token değişmemiş, backend'e gönderilmedi");
    return expoPushToken;
  }

  const validToken = await getValidToken();
  if (!validToken) {
    console.warn("[notifications] Auth token yok, backend'e gönderilmedi");
    return expoPushToken;
  }

  await sendTokenToBackend(expoPushToken, validToken);
  return expoPushToken;
}

/**
 * Logout'ta çağrılır — cache'i temizler ki yeni kullanıcıda token tekrar backend'e gitsin.
 */
export async function clearPushTokenCache() {
  await AsyncStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
}
