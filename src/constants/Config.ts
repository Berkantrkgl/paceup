// constants/Config.ts

// Eğer Android emülatörde "Network Error" alırsan burayı "http://10.0.2.2:8001" yap.
// iOS simülatör için "http://127.0.0.1:8001" veya "localhost" iyidir.
export const FASTAPI_URL = "http://127.0.0.1:8001";

const BASE_URL = "http://127.0.0.1:8000";
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
