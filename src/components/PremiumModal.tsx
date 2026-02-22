import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================
// TİPLER
// ============================================================
interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: "token_limit" | "feature" | "general"; // Neden açıldı
}

// ============================================================
// PLAN VERİLERİ
// ============================================================
const PLANS = [
  {
    id: "monthly",
    label: "AYLIK",
    price: "₺149",
    period: "/ay",
    priceNote: "İptal edilebilir",
    popular: false,
  },
  {
    id: "yearly",
    label: "YILLIK",
    price: "₺799",
    period: "/yıl",
    priceNote: "₺66/ay — %55 tasarruf",
    popular: true,
  },
];

const FEATURES = [
  { icon: "infinite", text: "Sınırsız AI chat & koşu koçluğu" },
  { icon: "flash", text: "Öncelikli plan oluşturma (Sonnet 4)" },
  { icon: "calendar", text: "Sınırsız program erteleme hakkı" },
  { icon: "analytics", text: "Gelişmiş performans analitiği" },
  { icon: "trophy", text: "Özel başarı rozetleri" },
  { icon: "notifications", text: "Akıllı antrenman bildirimleri" },
];

// ============================================================
// FEATURE ROW
// ============================================================
const FeatureRow = ({
  icon,
  text,
  delay,
}: {
  icon: string;
  text: string;
  delay: number;
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.featureRow, { opacity, transform: [{ translateX }] }]}
    >
      <View style={styles.featureIconWrap}>
        <Ionicons name={icon as any} size={16} color={COLORS.accent} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
  );
};

// ============================================================
// ANA MODAL
// ============================================================
export const PremiumModal = ({
  visible,
  onClose,
  reason = "general",
}: PremiumModalProps) => {
  const insets = useSafeAreaInsets();
  const { getValidToken, refreshUserData } = useContext(AuthContext);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Aç/kapat animasyonları
  useEffect(() => {
    if (visible) {
      setSuccess(false);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Demo satın alma
  const handlePurchase = async () => {
    setLoading(true);
    try {
      const validToken = await getValidToken();
      if (!validToken) return;

      const res = await fetch(`${API_URL}/users/activate_premium/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      if (res.ok) {
        setSuccess(true);
        await refreshUserData();
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (e) {
      console.error("Premium satın alma hatası:", e);
    } finally {
      setLoading(false);
    }
  };

  const headerText =
    reason === "token_limit"
      ? "AI Token Limitin Doldu 🔒"
      : reason === "feature"
        ? "Premium Özellik 💎"
        : "PaceUp Premium'u Keşfet 🚀";

  const subText =
    reason === "token_limit"
      ? "Ücretsiz kullanım hakkın bitti. Premium'a geç, sınırsız AI koçluğun tadını çıkar."
      : "Koşu hedeflerine ulaşmak için tüm özelliklerin kilidini aç.";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Kapat Butonu */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color="#888" />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Badge */}
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>💎 PREMIUM</Text>
            </View>

            <Text style={styles.headerTitle}>{headerText}</Text>
            <Text style={styles.headerSub}>{subText}</Text>
          </View>

          {/* Özellikler */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((f, i) => (
              <FeatureRow
                key={f.text}
                icon={f.icon}
                text={f.text}
                delay={i * 60}
              />
            ))}
          </View>

          {/* Ayraç */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Plan Seç</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Plan Kartları */}
          <View style={styles.plansRow}>
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlan(plan.id)}
                  activeOpacity={0.8}
                >
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.planLabel,
                      isSelected && styles.planLabelSelected,
                    ]}
                  >
                    {plan.label}
                  </Text>
                  <View style={styles.planPriceRow}>
                    <Text
                      style={[
                        styles.planPrice,
                        isSelected && styles.planPriceSelected,
                      ]}
                    >
                      {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                  <Text
                    style={[
                      styles.planNote,
                      isSelected && { color: COLORS.accent },
                    ]}
                  >
                    {plan.priceNote}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={COLORS.accent}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CTA Butonu */}
          <TouchableOpacity
            style={[styles.ctaBtn, (loading || success) && { opacity: 0.85 }]}
            onPress={handlePurchase}
            disabled={loading || success}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : success ? (
              <View style={styles.ctaBtnInner}>
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={styles.ctaBtnText}>Premium Aktif! 🎉</Text>
              </View>
            ) : (
              <View style={styles.ctaBtnInner}>
                <Ionicons name="flash" size={18} color="#000" />
                <Text style={styles.ctaBtnText}>
                  {selectedPlan === "yearly"
                    ? "Yıllık Planı Başlat"
                    : "Aylık Planı Başlat"}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Alt not */}
          <Text style={styles.footerNote}>
            İstediğin zaman iptal edebilirsin • Güvenli ödeme
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1410",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,69,1,0.2)",
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Header
  header: { alignItems: "center", paddingVertical: 20 },
  premiumBadge: {
    backgroundColor: "rgba(255,69,1,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,69,1,0.4)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  premiumBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14,
    color: "#A09588",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  // Features
  featuresContainer: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,69,1,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureText: { color: "#D0C8C0", fontSize: 14, flex: 1, lineHeight: 20 },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Plans
  plansRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  planCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    position: "relative",
    overflow: "hidden",
  },
  planCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(255,69,1,0.08)",
  },
  popularBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  popularBadgeText: {
    color: "#000",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  planLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 1,
    marginBottom: 6,
  },
  planLabelSelected: { color: COLORS.accent },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice: { fontSize: 24, fontWeight: "800", color: "#FFF" },
  planPriceSelected: { color: COLORS.accent },
  planPeriod: { fontSize: 12, color: "#888" },
  planNote: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    lineHeight: 14,
  },
  selectedCheck: {
    position: "absolute",
    top: 10,
    right: 10,
  },

  // CTA
  ctaBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  ctaBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Footer
  footerNote: {
    color: "#555",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
});
