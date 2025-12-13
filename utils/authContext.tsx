import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { Alert } from "react-native";

// Kullanıcı Veri Tipi
export type UserData = {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    date_joined?: string; // Backend genelde bunu gönderir

    // Fiziksel & Tercihler
    weight?: number;
    height?: number;
    gender?: string;
    experience_level?: string;
    preferred_distance?: string;
    weekly_goal?: number;

    // İstatistikler
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
        firstName: string,
        lastName: string,
        email: string,
        password: string
    ) => Promise<void>;
    logOut: () => void;
    refreshUserData: () => Promise<void>;
};

const authStorageKey = "auth-token";

// iOS Simülatör için 127.0.0.1, Fiziksel cihaz için bilgisayarın IP'sini (örn: 192.168.1.35) yaz.
const BASE_URL = "http://127.0.0.1:8000/api";

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

    // --- YARDIMCI: Token ile Kullanıcı Verisini Çek ---
    const fetchUserProfile = async (currentToken: string) => {
        try {
            const response = await fetch(`${BASE_URL}/users/me/`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                const userData: UserData = await response.json();
                setUser(userData);
            }
        } catch (error) {
            console.log("User fetch error:", error);
        }
    };

    // --- YARDIMCI: Oturumu Başlat (Token Kaydet & State Güncelle) ---
    const handleSessionStart = async (accessToken: string) => {
        try {
            await AsyncStorage.setItem(authStorageKey, accessToken);
            setToken(accessToken);
            setIsLoggedIn(true);
            await fetchUserProfile(accessToken); // Kullanıcı detaylarını çek
            router.replace("/"); // Ana sayfaya yönlendir
        } catch (error) {
            console.log("Session start error:", error);
        }
    };

    // --- 1. LOGIN ---
    const logIn = async (email: string, password: string) => {
        try {
            const response = await fetch(`${BASE_URL}/token/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // SimpleJWT varsayılan olarak 'username' key'i bekler (içine email yazsak bile)
                body: JSON.stringify({ email: email, password: password }),
            });

            const data = await response.json();

            if (response.ok && data.access) {
                await handleSessionStart(data.access);
            } else {
                Alert.alert(
                    "Giriş Başarısız",
                    data.detail || "E-posta veya şifre hatalı."
                );
            }
        } catch (error) {
            console.log("Login error:", error);
            Alert.alert("Hata", "Sunucuya bağlanılamadı.");
        }
    };

    // --- 2. REGISTER (AUTO LOGIN DAHİL) ---
    const register = async (
        firstName: string,
        lastName: string,
        email: string,
        password: string
    ) => {
        try {
            const response = await fetch(`${BASE_URL}/users/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    password: password,
                    // Username backend'de otomatik üretilecek
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Backend artık Create işleminde 'access' ve 'refresh' token dönüyor.
                if (data.access) {
                    console.log("Kayıt başarılı, otomatik giriş yapılıyor...");
                    await handleSessionStart(data.access);
                } else {
                    // Token dönmezse Login'e yönlendir (Fallback)
                    Alert.alert(
                        "Başarılı",
                        "Hesabınız oluşturuldu. Giriş yapabilirsiniz."
                    );
                    router.replace("/login");
                }
            } else {
                let errorMsg = "Kayıt yapılamadı.";
                if (data.email)
                    errorMsg = "Bu e-posta adresi zaten kullanılıyor.";
                else if (data.password)
                    errorMsg = "Şifre kriterleri sağlanmadı.";
                Alert.alert("Kayıt Hatası", errorMsg);
            }
        } catch (error) {
            console.log("Register error:", error);
            Alert.alert("Hata", "Sunucuya bağlanılamadı.");
        }
    };

    // --- LOGOUT ---
    const logOut = async () => {
        await AsyncStorage.removeItem(authStorageKey);
        setIsLoggedIn(false);
        setToken(null);
        setUser(null);
        router.replace("/login");
    };

    // --- STORAGE CHECK ---
    const getAuthFromStorage = async () => {
        try {
            const savedToken = await AsyncStorage.getItem(authStorageKey);
            if (savedToken) {
                setToken(savedToken);
                setIsLoggedIn(true);
                await fetchUserProfile(savedToken);
            }
        } catch (error) {
            console.log(error);
        }
        setIsReady(true);
    };

    const refreshUserData = async () => {
        if (token) await fetchUserProfile(token);
    };

    useEffect(() => {
        getAuthFromStorage();
    }, []);

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
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
