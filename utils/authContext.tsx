import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { Alert } from "react-native";

// Kullanıcı Veri Tipi
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
        firstName: string,
        lastName: string,
        email: string,
        password: string
    ) => Promise<void>;
    logOut: () => void;
    refreshUserData: () => Promise<void>;
};

const authStorageKey = "auth-token";
// IP Adresini Kontrol Et: Emülatör: 127.0.0.1, Fiziksel Cihaz: Bilgisayar IP'si (örn: 192.168.1.35)
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
    const segments = useSegments();

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
            } else {
                // Token geçersizse çıkış yap
                logOut();
            }
        } catch (error) {
            console.log("User fetch error:", error);
        }
    };

    // --- YARDIMCI: Oturumu Başlat ---
    const handleSessionStart = async (accessToken: string) => {
        try {
            await AsyncStorage.setItem(authStorageKey, accessToken);
            setToken(accessToken);
            setIsLoggedIn(true);
            // Önce kullanıcıyı çek, sonra yönlendir (Daha pürüzsüz geçiş için)
            await fetchUserProfile(accessToken);
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
                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
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

    // --- 2. REGISTER ---
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
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.access) {
                    await handleSessionStart(data.access);
                } else {
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
    };

    // --- NAVİGASYON KORUMASI (PROTECTED ROUTE) ---
    useEffect(() => {
        // Uygulama hazır değilse (token kontrolü bitmediyse) yönlendirme yapma
        if (!isReady) return;

        const inProtectedGroup = segments[0] === "(protected)";

        if (isLoggedIn && !inProtectedGroup) {
            // Giriş yapmış ama Login ekranındaysa -> Home'a at
            router.replace("/");
        } else if (!isLoggedIn && inProtectedGroup) {
            // Giriş yapmamış ama Home'daysa -> Login'e at
            router.replace("/login");
        }
    }, [isLoggedIn, segments, isReady]);

    // --- STORAGE CHECK (UYGULAMA AÇILIŞI) ---
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
        } finally {
            setIsReady(true);
        }
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
