import { API_URL } from "@/constants/Config";
import {
  clearPushTokenCache,
  configureNotificationHandler,
} from "@/utils/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useRouter, useSegments } from "expo-router";
import { jwtDecode } from "jwt-decode";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";

configureNotificationHandler();

GoogleSignin.configure({
  iosClientId:
    "your-google-ios-client-id.apps.googleusercontent.com",
  webClientId:
    "your-google-web-client-id.apps.googleusercontent.com",
});

// --- TİPLER ---
export type UserData = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_joined?: string;
  date_of_birth?: string;

  // Fiziksel & Profil Bilgileri
  weight?: number;
  height?: number;
  gender?: string;

  // Koşu & İstatistik Bilgileri
  max_runned_distance: number;
  current_pace: number;
  pace_display?: string;

  total_workouts: number;
  total_distance: number;
  total_time: number;
  current_streak: number;
  longest_streak: number;
  profile_image?: string | null;

  // Premium & SaaS
  is_premium: boolean;
  premium_type?: "monthly" | "yearly" | null;
  premium_expires_at?: string | null;
  total_tokens_used: number;
  preferred_running_days: number[];
  remaining_reschedules: number;

  // Bildirim Alanları
  push_token?: string | null;
  timezone?: string;
  preferred_reminder_time?: string;
  notification_workout_reminder?: boolean;
  notification_weekly_report?: boolean;
  notification_achievements?: boolean;
  notification_plan_updates?: boolean;

  // hesap bilgileri.
  remaining_tokens: number | null;
  can_use_chat: boolean;
  is_onboarded: boolean;
  tour_home: boolean;
  tour_calendar: boolean;
  tour_plans: boolean;
  tour_profile: boolean;
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
  googleSignIn: () => Promise<void>;
  logOut: () => void;
  refreshUserData: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
};

// --- CONSTANTS ---
const ACCESS_TOKEN_KEY = "auth-access-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";
const TOKEN_EXPIRY_BUFFER = 120; // Token bitimine 2 dk kala yenile

// Paralel refresh isteklerini önlemek için singleton promise
let refreshPromise: Promise<string | null> | null = null;

export const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isReady: false,
  token: null,
  user: null,
  logIn: async () => {},
  register: async () => {},
  googleSignIn: async () => {},
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

  // --- TOKEN MANTIĞI ---
  const logOut = useCallback(async () => {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    await clearPushTokenCache();
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  const refreshAccessToken = async (): Promise<string | null> => {
    // Zaten devam eden bir refresh varsa aynı promise'i bekle — yeni istek gönderme
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          await logOut();
          return null;
        }

        const response = await fetch(`${API_URL}/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        const data = await response.json();
        if (response.ok && data.access) {
          await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
          setToken(data.access);
          return data.access;
        } else {
          // Sadece refresh token geçersizse (401) logout yap
          if (response.status === 401) await logOut();
          return null;
        }
      } catch {
        // Network hatası veya timeout — logout etme, sadece null dön
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  const getValidToken = async (): Promise<string | null> => {
    // State yerine doğrudan AsyncStorage'dan oku — stale closure sorununu önler
    const currentToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    if (!currentToken) return null;

    try {
      const decoded: any = jwtDecode(currentToken);
      const isExpired = decoded.exp < Date.now() / 1000 + TOKEN_EXPIRY_BUFFER;

      if (isExpired) {
        return await refreshAccessToken();
      }
      return currentToken;
    } catch {
      return null;
    }
  };

  // --- USER DATA ---
  // Başarılı ise true döner. Launch'ta init fail'i yakalayıp kullanıcıya gösterebilsin diye.
  const fetchUserProfile = async (validToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/users/me/`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      }
      if (response.status === 401) {
        // Token geçersizleşmiş — logout flow'u getValidToken içinden akar
        return false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const refreshUserData = async () => {
    const validToken = await getValidToken();
    if (validToken) await fetchUserProfile(validToken);
  };

  // Push token senkronu home screen mount olunca tetiklenir (src/app/(protected)/(tabs)/(home)/index.tsx).
  // İzin prompt'unu kullanıcı ana ekranı görmeden önce göstermemek için auth akışından çıkartıldı.

  // --- GOOGLE SIGN IN ---
  const googleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type === "cancelled") return;

      const idToken = response.data?.idToken;
      if (!idToken) {
        Alert.alert("Hata", "Google'dan token alınamadı.");
        return;
      }

      // Backend'e id_token gönder — kullanıcı oluşturur/bulur, JWT döner
      const res = await fetch(`${API_URL}/auth/google/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await res.json();
      if (res.ok && data.access && data.refresh) {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
        setToken(data.access);
        setIsLoggedIn(true);
        await fetchUserProfile(data.access);
      } else {
        Alert.alert("Hata", data.detail || "Google ile giriş başarısız.");
      }
    } catch (e: any) {
      if (e.code !== "SIGN_IN_CANCELLED") {
        console.error("Google Sign-In error:", e);
        Alert.alert("Hata", "Google ile giriş sırasında bir sorun oluştu.");
      }
    }
  };

  // --- ACTIONS ---
  const logIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data.access && data.refresh) {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
        setToken(data.access);
        setIsLoggedIn(true);
        await fetchUserProfile(data.access);
      } else {
        Alert.alert("Hata", "Giriş bilgileri hatalı.");
      }
    } catch {
      Alert.alert("Hata", "Sunucuya bağlanılamadı.");
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
      if (response.ok) {
        const data = await response.json();
        if (data.access) {
          await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
          setToken(data.access);
          setIsLoggedIn(true);
          await fetchUserProfile(data.access);
        } else {
          router.replace("/login");
        }
      } else {
        Alert.alert(
          "Hata",
          "Bu e-posta adresiyle daha önce kayıt olunmuş olabilir.",
        );
      }
    } catch {
      Alert.alert("Hata", "Kayıt sırasında bir sorun oluştu.");
    }
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const savedToken = await getValidToken();
      if (!savedToken) {
        setIsReady(true);
        return;
      }

      setToken(savedToken);

      // /users/me/ bir kez deneyelim; network hatasında 1500ms sonra tek retry
      let ok = await fetchUserProfile(savedToken);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 1500));
        ok = await fetchUserProfile(savedToken);
      }

      if (ok) {
        setIsLoggedIn(true);
      } else {
        // Token var ama profile çekilemedi (network/server sorunu).
        // isLoggedIn=false bırakıyoruz → kullanıcı login'e düşer, oradan tekrar deneyebilir.
        // Token'ı silmiyoruz; sadece yeniden başlatınca tekrar denenecek.
        Alert.alert(
          "Bağlantı Sorunu",
          "Profil bilgilerin yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.",
        );
      }

      setIsReady(true);
    };
    init();
  }, []);

  // --- NAVIGATION PROTECTION ---
  useEffect(() => {
    if (!isReady) return;
    const inProtected = segments[0] === "(protected)";
    const inOnboarding = segments[0] === "onboarding";

    if (isLoggedIn && user?.is_onboarded === false && !inOnboarding) {
      // Onboarding tamamlanmamış → onboarding ekranına yönlendir
      router.replace("/onboarding");
    } else if (isLoggedIn && user?.is_onboarded !== false && !inProtected) {
      // Onboarding tamam, ana ekrana yönlendir
      router.replace("/");
    } else if (!isLoggedIn && (inProtected || inOnboarding)) {
      router.replace("/login");
    }
  }, [isLoggedIn, segments, isReady, user?.is_onboarded]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isReady,
        token,
        user,
        logIn,
        register,
        googleSignIn,
        logOut,
        refreshUserData,
        getValidToken, // Dışarıya açıldı!
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
