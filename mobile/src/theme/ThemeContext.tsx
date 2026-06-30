import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import {
  darkTheme,
  lightTheme,
  type Theme,
  type ThemeColors,
  type ThemeName,
} from "./tokens";

// Kullanıcının tercihi: 'system' sistemi takip eder, 'light'/'dark' override.
export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
};

const PREFERENCE_KEY = "theme-preference-v1";
const DEFAULT_PREFERENCE: ThemePreference = "system";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
): ThemeName {
  if (preference === "system") {
    return systemScheme === "light" ? "light" : "dark";
  }
  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [hydrated, setHydrated] = useState(false);

  // AsyncStorage'dan kullanıcı tercihini yükle (bir kez, mount'ta)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCE_KEY);
        if (stored === "system" || stored === "light" || stored === "dark") {
          setPreferenceState(stored);
        }
      } catch {
        // Storage okunamazsa default'a düş
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      await AsyncStorage.setItem(PREFERENCE_KEY, pref);
    } catch {
      // Sessizce yut — state zaten güncel
    }
  }, []);

  const resolvedName = resolveTheme(preference, systemScheme);
  const theme = resolvedName === "light" ? lightTheme : darkTheme;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      theme,
      colors: theme.colors,
      isDark: theme.name === "dark",
      setPreference,
    }),
    [preference, theme, setPreference]
  );

  // Hydration bitene kadar children'ı render etme — ilk frame'de yanlış tema
  // flash'ını önler. Faz 0'da FORCE_DARK=true olduğundan fark etmez, ama
  // Faz 1 için doğru davranışı şimdiden kurmak önemli.
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
