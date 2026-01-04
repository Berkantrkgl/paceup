// Localhost android emülatör için genelde 10.0.2.2, iOS için 127.0.0.1 kullanılır.
// Fiziksel cihaz için bilgisayarının yerel IP'sini (örn: 192.168.1.XX) yazmalısın.

const BASE_URL = "http://127.0.0.1:8000"; // Backend adresin

export const API_URL = `${BASE_URL}/api`;
// export const MEDIA_URL = `${BASE_URL}/media`; // Profil fotoları vb. için

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
