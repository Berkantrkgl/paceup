// constants/Config.ts

import Constants from "expo-constants";

// true → fiziksel cihazda test (Expo Go), bilgisayarın local IP'sini kullanır
// false → simülatörde test, 127.0.0.1 kullanır
const USE_PHYSICAL_DEVICE = true;

const getLocalIP = () => {
  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  return debuggerHost?.split(":")[0] ?? "192.168.1.7";
};

const HOST = USE_PHYSICAL_DEVICE ? getLocalIP() : "127.0.0.1";

export const FASTAPI_URL = `http://${HOST}:8001`;
const BASE_URL = `http://${HOST}:8000`;

export const API_URL = `${BASE_URL}/api`;

export const COLORS = {
  background: "#201911", // Ana arka plan (Derin Kahve/Siyah)
  card: "#2F261D", // Kart Rengi (Background'dan biraz daha açık)
  cardBorder: "#4A3F35", // Kart Kenarlıkları (Ayrımı belirginleştirmek için)

  text: "#EAEAEA", // Ana metin (Okunabilirliği artırmak için biraz daha parlak)
  subText: "#A09588", // Açıklamalar (Kahve tonuna uyumlu gri)

  accent: "#FF4501", // Ana Vurgu (Kırmızımsı Turuncu) - Solid
  secondary: "#FA7D09", // İkincil Turuncu (Daha sarımsı)

  inactive: "#6D5E52", // Pasif ikonlar
  success: "#4ECDC4", // Başarı (Yeşil)
  white: "#FFFFFF",
};
