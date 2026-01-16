import { API_URL } from "@/constants/Config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { Alert } from "react-native";

// --- TİPLER ---
export type UserData = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined?: string;
  weight?: number;
  height?: number;
  gender?: string;
  experience_level?: string;
  preferred_distance?: string;
  weekly_goal?: number;
  total_workouts: number;
  total_distance: number;
  total_time: number;
  current_streak: number;
  longest_streak: number;
};

type AuthState = {
  isLoggedIn: boolean;
  isReady: boolean;
  token: string | null;
  user: UserData | null;
  logIn: (email: string, password: string) => Promise<void>;
  register: (
    fName: string,
    lName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logOut: () => void;
  refreshUserData: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
};

// --- CONSTANTS ---
const ACCESS_TOKEN_KEY = "auth-access-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";
// Token süresi bitimine kaç saniye kala yenileme yapalım? (Güvenlik payı)
const TOKEN_EXPIRY_BUFFER = 120; // 2 dakika

export const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isReady: false,
  token: null,
  user: null,
  logIn: async () => {},
  register: async () => {},
  logOut: () => {},
  refreshUserData: async () => {},
  getValidToken: async () => null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // ============================================================
  // 🔄 1. TOKEN YÖNETİMİ (CORE LOGIC)
  // ============================================================

  /**
   * Backend'e Refresh Token gönderip yeni Access Token alır.
   * Başarısız olursa kullanıcıyı çıkışa zorlar.
   */
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error("Refresh token bulunamadı.");

      console.log("🔄 Token yenileniyor...");

      const response = await fetch(`${API_URL}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      const data = await response.json();

      if (response.ok && data.access) {
        console.log("✅ Token başarıyla yenilendi.");
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
        setToken(data.access);
        return data.access;
      } else {
        console.log("❌ Refresh token geçersiz, oturum kapatılıyor.");
        await logOut(); // Refresh token da ölmüşse logout şart
        return null;
      }
    } catch (error) {
      console.log("⚠️ Token refresh hatası:", error);
      await logOut();
      return null;
    }
  };

  /**
   * API isteklerinden önce çağrılır.
   * Token süresini kontrol eder, gerekirse yeniler ve geçerli token döner.
   */
  const getValidToken = async (): Promise<string | null> => {
    let currentToken = token;

    // State boşsa storage'a bak (Sayfa yenileme veya deep link durumu)
    if (!currentToken) {
      currentToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    }

    if (!currentToken) return null;

    try {
      const decoded: any = jwtDecode(currentToken);
      const now = Date.now() / 1000;

      // Token'ın bitiş süresine BUFFER kadar zaman kaldıysa YENİLE
      if (decoded.exp < now + TOKEN_EXPIRY_BUFFER) {
        console.log(
          `⏳ Token süresi dolmak üzere (veya doldu). Yenileniyor...`,
        );
        return await refreshAccessToken();
      }

      return currentToken;
    } catch (error) {
      console.log("⚠️ Token decode edilemedi, geçersiz sayılıyor.");
      return null;
    }
  };

  // ============================================================
  // 👤 2. KULLANICI VERİSİ
  // ============================================================

  const fetchUserProfile = async (validToken: string) => {
    try {
      const response = await fetch(`${API_URL}/users/me/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userData: UserData = await response.json();
        setUser(userData);
      } else if (response.status === 401) {
        // Token geçerli sandık ama backend 401 verdi (örn: sunucu tarafında blacklist oldu)
        // Bir şans daha verip refresh deneyebiliriz veya direkt logout
        console.log("User fetch 401 aldı, logout yapılıyor.");
        await logOut();
      }
    } catch (error) {
      console.log("User fetch network error:", error);
    }
  };

  const refreshUserData = async () => {
    const validToken = await getValidToken();
    if (validToken) {
      await fetchUserProfile(validToken);
    }
  };

  // ============================================================
  // 🚪 3. GİRİŞ / ÇIKIŞ İŞLEMLERİ
  // ============================================================

  const handleSessionStart = async (
    accessToken: string,
    refreshToken: string,
  ) => {
    try {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      setToken(accessToken);
      setIsLoggedIn(true);

      // Token kaydettikten hemen sonra profil çek
      await fetchUserProfile(accessToken);
    } catch (error) {
      console.log("Session start error:", error);
    }
  };

  const logIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.access && data.refresh) {
        await handleSessionStart(data.access, data.refresh);
      } else {
        Alert.alert(
          "Giriş Başarısız",
          data.detail || "Bilgilerinizi kontrol ediniz.",
        );
      }
    } catch (error) {
      Alert.alert("Hata", "Sunucuya ulaşılamadı.");
    }
  };

  const register = async (
    fName: string,
    lName: string,
    email: string,
    password: string,
  ) => {
    try {
      const response = await fetch(`${API_URL}/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: fName,
          last_name: lName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.access && data.refresh) {
          await handleSessionStart(data.access, data.refresh);
        } else {
          Alert.alert("Başarılı", "Kayıt olundu. Giriş yapabilirsiniz.");
          router.replace("/login");
        }
      } else {
        Alert.alert("Kayıt Hatası", "Bilgileri kontrol edin.");
      }
    } catch (error) {
      Alert.alert("Hata", "Sunucuya ulaşılamadı.");
    }
  };

  const logOut = async () => {
    console.log("🚪 Çıkış yapılıyor...");
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem("auth-token"); // Legacy temizliği

    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  };

  // ============================================================
  // 🚀 4. UYGULAMA BAŞLANGICI (INITIALIZATION)
  // ============================================================

  const loadUserFromStorage = async () => {
    try {
      const savedAccess = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      const savedRefresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      // 1. Hiç token yoksa -> Login ekranına
      if (!savedAccess || !savedRefresh) {
        setIsReady(true);
        return;
      }

      // 2. Token var, kontrol et
      try {
        const decoded: any = jwtDecode(savedAccess);
        const now = Date.now() / 1000;

        // Access Token geçerli mi?
        if (decoded.exp > now) {
          console.log("🚀 Başlangıç: Access Token geçerli.");
          setToken(savedAccess);
          setIsLoggedIn(true);
          await fetchUserProfile(savedAccess);
        } else {
          // Access Token bitmiş, Refresh Token ile sessizce yenilemeyi dene
          console.log("🚀 Başlangıç: Access Token bitmiş, yenileniyor...");
          const newAccess = await refreshAccessToken();

          if (newAccess) {
            // Yenileme başarılı -> İçeri al
            setIsLoggedIn(true);
            await fetchUserProfile(newAccess);
          } else {
            // Yenileme başarısız (Refresh token da bitmiş) -> Logout
            await logOut();
          }
        }
      } catch (e) {
        // Token bozuksa logout
        await logOut();
      }
    } catch (error) {
      console.log("Storage load error:", error);
    } finally {
      setIsReady(true); // Splash screen kalkabilir
    }
  };

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  // ============================================================
  // 🛡️ 5. NAVİGASYON KORUMASI
  // ============================================================

  useEffect(() => {
    if (!isReady) return;
    const inProtectedGroup = segments[0] === "(protected)";

    if (isLoggedIn && !inProtectedGroup) {
      // Login olmuş kullanıcı login sayfasındaysa -> Home'a at
      router.replace("/");
    } else if (!isLoggedIn && inProtectedGroup) {
      // Login olmamış kullanıcı korumalı alandaysa -> Login'e at
      router.replace("/login");
    }
  }, [isLoggedIn, segments, isReady]);

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isLoggedIn,
        token,
        user,
        logIn,
        register,
        logOut,
        refreshUserData,
        getValidToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
