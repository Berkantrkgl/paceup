import { API_URL } from "@/constants/Config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { jwtDecode } from "jwt-decode"; // 📦 YENİ EKLENDİ
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
    refreshUserData: () => Promise<void>; // ✅ Eskiden vardı, koruduk
    getValidToken: () => Promise<string | null>; // ✅ YENİ: Token kontrolü için
};

// Storage Key'lerini ayırdık
const ACCESS_TOKEN_KEY = "auth-access-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";

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

    // --- 1. YARDIMCI: Backend'den Refresh Token ile Yeni Access Token Al ---
    const refreshAccessToken = async (): Promise<string | null> => {
        try {
            const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
            if (!refreshToken) throw new Error("Refresh token yok");

            const response = await fetch(`${API_URL}/token/refresh/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh: refreshToken }),
            });

            const data = await response.json();

            if (response.ok && data.access) {
                // Yeni token'ı kaydet
                await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
                setToken(data.access);
                return data.access;
            } else {
                throw new Error("Refresh token geçersiz");
            }
        } catch (error) {
            console.log("Token yenileme hatası:", error);
            logOut(); // Yenileyemezsek çıkış yap
            return null;
        }
    };

    // --- 2. YENİ FONKSİYON: Token Geçerli mi? (Süresi dolduysa yenile) ---
    // Chatbot ve diğer API isteklerinde bunu kullanacağız.
    const getValidToken = async (): Promise<string | null> => {
        // Eğer state'de token yoksa storage'a bak (sayfa yenileme durumu)
        let currentToken = token;
        if (!currentToken) {
            currentToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        }

        if (!currentToken) return null;

        try {
            const decoded: any = jwtDecode(currentToken);
            const now = Date.now() / 1000;

            // Eğer sürenin dolmasına 30 saniyeden az kaldıysa veya dolduysa
            if (decoded.exp < now + 30) {
                console.log("Token süresi doluyor/doldu. Yenileniyor...");
                return await refreshAccessToken();
            }

            return currentToken;
        } catch (error) {
            console.log("Token decode hatası:", error);
            return null;
        }
    };

    // --- YARDIMCI: Kullanıcı Profilini Çek ---
    const fetchUserProfile = async (currentToken: string) => {
        try {
            const response = await fetch(`${API_URL}/users/me/`, {
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
                // Sadece 401 ise çıkış yap, diğer hatalarda yapma
                if (response.status === 401) logOut();
            }
        } catch (error) {
            console.log("User fetch error:", error);
        }
    };

    // --- ESKİ FONKSİYON: Home Ekranı İçin Manuel Yenileme ---
    // Hata almamak için bunu burada tutuyoruz.
    const refreshUserData = async () => {
        const validToken = await getValidToken();
        if (validToken) {
            await fetchUserProfile(validToken);
        }
    };

    // --- OTURUM BAŞLATMA (Login/Register Sonrası) ---
    const handleSessionStart = async (
        accessToken: string,
        refreshToken: string
    ) => {
        try {
            await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
            setToken(accessToken);
            setIsLoggedIn(true);
            await fetchUserProfile(accessToken);
        } catch (error) {
            console.log("Session start error:", error);
        }
    };

    // --- LOGIN ---
    const logIn = async (email: string, password: string) => {
        try {
            const response = await fetch(`${API_URL}/token/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.access && data.refresh) {
                // Hem access hem refresh token'ı kaydediyoruz
                await handleSessionStart(data.access, data.refresh);
            } else {
                Alert.alert(
                    "Giriş Başarısız",
                    data.detail || "Bilgileri kontrol edin."
                );
            }
        } catch (error) {
            console.log("Login error:", error);
            Alert.alert("Hata", "Sunucuya bağlanılamadı.");
        }
    };

    // --- REGISTER ---
    const register = async (
        fName: string,
        lName: string,
        email: string,
        password: string
    ) => {
        try {
            const response = await fetch(`${API_URL}/users/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: fName,
                    last_name: lName,
                    email: email,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Kayıt başarılıysa otomatik giriş yap (Access ve Refresh varsa)
                if (data.access && data.refresh) {
                    await handleSessionStart(data.access, data.refresh);
                } else {
                    Alert.alert(
                        "Başarılı",
                        "Hesap oluşturuldu. Giriş yapabilirsiniz."
                    );
                    router.replace("/login");
                }
            } else {
                Alert.alert("Kayıt Hatası", "Bilgileri kontrol edin.");
            }
        } catch (error) {
            console.log("Register error:", error);
            Alert.alert("Hata", "Sunucuya bağlanılamadı.");
        }
    };

    // --- LOGOUT ---
    const logOut = async () => {
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        // Eski key varsa onu da sil temizlik olsun
        await AsyncStorage.removeItem("auth-token");

        setIsLoggedIn(false);
        setToken(null);
        setUser(null);
    };

    // --- APP BAŞLANGICI: STORAGE KONTROLÜ ---
    const getAuthFromStorage = async () => {
        try {
            const savedAccess = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
            const savedRefresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

            // Eski sistemden kalan token var mı? Varsa onu access olarak al
            const oldToken = await AsyncStorage.getItem("auth-token");

            if (savedAccess && savedRefresh) {
                setToken(savedAccess);
                setIsLoggedIn(true);
                await fetchUserProfile(savedAccess);
            } else if (oldToken) {
                // Eski versiyondan geçiş yapan kullanıcılar için fallback
                setToken(oldToken);
                setIsLoggedIn(true);
                await fetchUserProfile(oldToken);
            }
        } catch (error) {
            console.log(error);
        } finally {
            setIsReady(true);
        }
    };

    useEffect(() => {
        getAuthFromStorage();
    }, []);

    // --- NAVİGASYON KORUMASI ---
    useEffect(() => {
        if (!isReady) return;
        const inProtectedGroup = segments[0] === "(protected)";

        if (isLoggedIn && !inProtectedGroup) {
            router.replace("/");
        } else if (!isLoggedIn && inProtectedGroup) {
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
                refreshUserData, // ✅ Hata veren fonksiyon burada
                getValidToken, // ✅ Chatbot'un ihtiyacı olan fonksiyon burada
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
