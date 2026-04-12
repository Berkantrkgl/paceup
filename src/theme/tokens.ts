// Theme tokens — dark ve light palet tanımları
//
// Kullanım:
//   import { darkTokens, lightTokens, type Theme } from "@/theme/tokens";
//
// Her iki palet de aynı shape'e sahiptir. Tema değişiminde yüzeyler, metinler
// ve border'lar flip olur; marka rengi (accent) her iki modda da aynı kalır.

export type ThemeName = "light" | "dark";

export type ThemeColors = {
  // Yüzeyler
  background: string; // Ekran arkaplanı
  surface: string; // Kartlar, modaller
  surfaceVariant: string; // Yükseltilmiş kart / input
  overlay: string; // Modal scrim

  // Kenarlıklar
  border: string;
  borderStrong: string;

  // Metin
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string; // Accent üstündeki metin
  };

  // Marka
  accent: string;
  accentMuted: string; // Accent'in soluk arkaplan versiyonu
  secondary: string;

  // Semantik
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Diğer
  shadow: string;
  inactive: string;

  // Sabitler (tema değişiminden etkilenmez — tool/utility için)
  white: string;
  transparent: string;
};

export type Theme = {
  name: ThemeName;
  colors: ThemeColors;
};

// ═════════════════════════════════════════════
//                 DARK TOKENS
// ═════════════════════════════════════════════
// Mevcut "Carbon Dark + Turuncu" paletinin birebir karşılığı.
// Eski COLORS → yeni token eşlemeleri:
//   background → background
//   card       → surface
//   cardVariant→ surfaceVariant
//   cardBorder → border
//   text       → text.primary
//   textDim    → text.secondary
//   accent     → accent
//   secondary  → secondary

export const darkColors: ThemeColors = {
  background: "#0D0D0D",
  surface: "#1A1A1A",
  surfaceVariant: "#242424",
  overlay: "rgba(0, 0, 0, 0.6)",

  border: "#333333",
  borderStrong: "#4A4A4A",

  text: {
    primary: "#F5F5F5",
    secondary: "#888888",
    disabled: "#555555",
    inverse: "#FFFFFF",
  },

  accent: "#FF4501",
  accentMuted: "rgba(255, 69, 1, 0.15)",
  secondary: "#FA7D09",

  success: "#28C76F",
  warning: "#FFD93D",
  danger: "#FF4D4D",
  info: "#A569BD",

  shadow: "rgba(0, 0, 0, 0.5)",
  inactive: "#555555",

  white: "#FFFFFF",
  transparent: "transparent",
};

// ═════════════════════════════════════════════
//                 LIGHT TOKENS
// ═════════════════════════════════════════════
// Warm (sıcak) light palet — pure white yerine hafif krem/bej tonları.
// Arkaplan hafif sarımsı-bej, yüzeyler kırık beyaz, metin koyu kahve-siyah.
// Marka rengi (turuncu) dark ile birebir aynı tutuldu.

export const lightColors: ThemeColors = {
  background: "#FBF7F2", // Sıcak krem
  surface: "#FFFFFF", // Kart zemini (temiz beyaz, background ile kontrast)
  surfaceVariant: "#F5EFE6", // Yükseltilmiş yüzey / input (bej)
  overlay: "rgba(40, 28, 18, 0.45)", // Kahve tonlu scrim

  border: "#ECE3D4", // Sıcak bej border
  borderStrong: "#D9CCB6",

  text: {
    primary: "#1F1B16", // Kahve-siyah
    secondary: "#6B5F52", // Sıcak gri-kahve
    disabled: "#A89C8E",
    inverse: "#FFFFFF",
  },

  accent: "#FF4501", // Marka — dark ile aynı
  accentMuted: "rgba(255, 69, 1, 0.12)",
  secondary: "#FA7D09",

  success: "#1FA35B", // Beyaz zeminde kontrast için biraz koyu
  warning: "#D9A800",
  danger: "#E53935",
  info: "#7B4FB3",

  shadow: "rgba(60, 42, 24, 0.10)", // Sıcak ton gölge
  inactive: "#B8AC9C",

  white: "#FFFFFF",
  transparent: "transparent",
};

export const darkTheme: Theme = {
  name: "dark",
  colors: darkColors,
};

export const lightTheme: Theme = {
  name: "light",
  colors: lightColors,
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;
