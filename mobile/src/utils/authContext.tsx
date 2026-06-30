import { API_URL } from "@/constants/Config";
import {
  clearPushTokenCache,
  configureNotificationHandler,
} from "@/utils/notifications";
import {
  addCustomerInfoListener,
  configureRevenueCat,
  identifyRevenueCatUser,
  logoutRevenueCat,
} from "@/utils/revenuecat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Localization from "expo-localization";
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
configureRevenueCat();

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
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
  premium_will_renew?: boolean;
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
  appleSignIn: () => Promise<void>;
  logOut: () => void;
  refreshUserData: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
};

// --- CONSTANTS ---
const ACCESS_TOKEN_KEY = "auth-access-token";
const REFRESH_TOKEN_KEY = "auth-refresh-token";
const TOKEN_EXPIRY_BUFFER = 120; // Token bitimine 2 dk kala yenile

// Cihazın IANA timezone'unu backend'e PATCH'ler.
// expo-localization → native iOS/Android TZ API (Hermes'te Intl'den daha güvenilir).
// currentTz backend'den gelen değerle karşılaştırılır — local cache yok.
async function syncTimezone(
  getToken: () => Promise<string | null>,
  currentTz: string | null | undefined,
) {
  const deviceTz = getDeviceTimezone();
  if (!deviceTz) return;
  if (deviceTz === currentTz) return;

  const token = await getToken();
  if (!token) return;

  try {
    await fetch(`${API_URL}/users/me/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ timezone: deviceTz }),
    });
  } catch {
    // Network hatası — bir sonraki açılışta tekrar denenir
  }
}

function getDeviceTimezone(): string | null {
  try {
    const cal = Localization.getCalendars()?.[0];
    if (cal?.timeZone) return cal.timeZone;
  } catch {
    // fall through to Intl
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    // ignore
  }
  return null;
}

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
  appleSignIn: async () => {},
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
    await logoutRevenueCat();
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
          // ROTATE_REFRESH_TOKENS backend'de açık: her refresh yeni bir refresh
          // token döner. Bunu kaydetmezsek 180 günlük pencere KAYMAZ ve sabit
          // sınır olur. Yeni refresh'i sakla ki düzenli kullanan kullanıcı hiç
          // logout olmasın.
          if (data.refresh) {
            await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
          }
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
  // Başarılı ise user döner, değilse null. Launch'ta init fail'i yakalayıp kullanıcıya gösterebilsin diye.
  const fetchUserProfile = async (
    validToken: string,
  ): Promise<UserData | null> => {
    try {
      const response = await fetch(`${API_URL}/users/me/`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (response.ok) {
        const userData: UserData = await response.json();
        setUser(userData);
        return userData;
      }
      return null;
    } catch {
      return null;
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
        const profile = await fetchUserProfile(data.access);
        syncTimezone(getValidToken, profile?.timezone);
        if (profile?.id) await identifyRevenueCatUser(profile.id);
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

  // --- APPLE SIGN IN ---
  const appleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        Alert.alert("Hata", "Apple'dan token alınamadı.");
        return;
      }

      // Apple isim/email'i SADECE ilk girişte döner. Backend identity_token'dan
      // email çıkarır; isim token'da olmadığı için ilk akıştan gelen full_name'i
      // ayrıca gönderiyoruz (yeni kullanıcı oluşturulurken kaydedilir).
      const res = await fetch(`${API_URL}/auth/apple/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: identityToken,
          full_name: credential.fullName
            ? {
                givenName: credential.fullName.givenName,
                familyName: credential.fullName.familyName,
              }
            : null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.access && data.refresh) {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
        setToken(data.access);
        setIsLoggedIn(true);
        const profile = await fetchUserProfile(data.access);
        syncTimezone(getValidToken, profile?.timezone);
        if (profile?.id) await identifyRevenueCatUser(profile.id);
      } else {
        Alert.alert("Hata", data.error || "Apple ile giriş başarısız.");
      }
    } catch (e: any) {
      // Kullanıcı Apple sheet'ini kapattıysa sessizce yok say.
      if (e.code !== "ERR_REQUEST_CANCELED") {
        console.error("Apple Sign-In error:", e);
        Alert.alert("Hata", "Apple ile giriş sırasında bir sorun oluştu.");
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
        const profile = await fetchUserProfile(data.access);
        syncTimezone(getValidToken, profile?.timezone);
        if (profile?.id) await identifyRevenueCatUser(profile.id);
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
          const profile = await fetchUserProfile(data.access);
          syncTimezone(getValidToken, profile?.timezone);
          if (profile?.id) await identifyRevenueCatUser(profile.id);
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
      let profile = await fetchUserProfile(savedToken);
      if (!profile) {
        await new Promise((r) => setTimeout(r, 1500));
        profile = await fetchUserProfile(savedToken);
      }

      if (profile) {
        setIsLoggedIn(true);
        syncTimezone(getValidToken, profile.timezone);
        if (profile.id) await identifyRevenueCatUser(profile.id);
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

  // --- REVENUECAT CUSTOMER INFO LISTENER ---
  // Multi-device + webhook sync: RC SDK customer info değişince (renewal,
  // başka cihazda satın alma, grace period vb.) backend'i resync ediyoruz.
  // Backend RC webhook ile zaten haberdar; refreshUserData /users/me/'yi
  // çekerek AuthContext'i ve UI'ı güncel state'e taşır.
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    const unsubscribe = addCustomerInfoListener(() => {
      refreshUserData();
    });
    return unsubscribe;
  }, [isLoggedIn, user?.id]);

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
        appleSignIn,
        logOut,
        refreshUserData,
        getValidToken, // Dışarıya açıldı!
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
