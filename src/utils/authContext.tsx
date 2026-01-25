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
  profile_image?: string | null; // Profil resmi eklendi
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
  // getValidToken'ı buradan sildik, karmaşayı önlemek için private kullanacağız.
};

// --- CONSTANTS ---
const ACCESS_TOKEN_KEY = "auth-access-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";
const TOKEN_EXPIRY_BUFFER = 120;

// Initial State
export const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isReady: false,
  token: null,
  user: null,
  logIn: async () => {},
  register: async () => {},
  logOut: () => {},
  refreshUserData: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // --- TOKEN MANTIĞI ---
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error("No refresh token");

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
        await logOut();
        return null;
      }
    } catch {
      await logOut();
      return null;
    }
  };

  const getValidTokenInternal = async (): Promise<string | null> => {
    let currentToken = token || (await AsyncStorage.getItem(ACCESS_TOKEN_KEY));
    if (!currentToken) return null;

    try {
      const decoded: any = jwtDecode(currentToken);
      if (decoded.exp < Date.now() / 1000 + TOKEN_EXPIRY_BUFFER) {
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
    const validToken = await getValidTokenInternal();
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
        Alert.alert("Hata", "Giriş yapılamadı.");
      }
    } catch {
      Alert.alert("Hata", "Sunucu hatası.");
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
        if (data.access && data.refresh) {
          await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
          setToken(data.access);
          setIsLoggedIn(true);
          await fetchUserProfile(data.access);
        } else {
          Alert.alert("Başarılı", "Kayıt oldunuz, giriş yapın.");
          router.replace("/login");
        }
      } else {
        Alert.alert("Hata", "Kayıt başarısız.");
      }
    } catch {
      Alert.alert("Hata", "Sunucu hatası.");
    }
  };

  const logOut = async () => {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const savedToken = await getValidTokenInternal();
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
    if (isLoggedIn && !inProtected) router.replace("/");
    else if (!isLoggedIn && inProtected) router.replace("/login");
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
