import { API_URL } from "@/constants/Config";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

  // Yeni Eklenen Alanlar
  is_premium: boolean;
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
  getValidToken: () => Promise<string | null>; // Chatbot için kritik ekleme
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
  const fetchUserProfile = async (validToken: string) => {
    try {
      const response = await fetch(`${API_URL}/users/me/`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (e) {
      console.log("Fetch user error", e);
    }
  };

  const refreshUserData = async () => {
    const validToken = await getValidToken();
    if (validToken) await fetchUserProfile(validToken);
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
      if (savedToken) {
        setToken(savedToken);
        setIsLoggedIn(true);
        await fetchUserProfile(savedToken);
      }
      setIsReady(true);
    };
    init();
  }, []);

  // --- NAVIGATION PROTECTION ---
  useEffect(() => {
    if (!isReady) return;
    const inProtected = segments[0] === "(protected)";

    if (isLoggedIn && !inProtected) {
      router.replace("/");
    } else if (!isLoggedIn && inProtected) {
      router.replace("/login");
    }
  }, [isLoggedIn, segments, isReady]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isReady,
        token,
        user,
        logIn,
        register,
        logOut,
        refreshUserData,
        getValidToken, // Dışarıya açıldı!
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
