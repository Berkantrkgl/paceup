import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============================================================
// PLAN VERİLERİ
// ============================================================
const PLANS = [
  {
    id: "monthly",
    label: "AYLIK",
    price: "₺149",
    period: "/ay",
    priceNote: "İstediğin zaman iptal et",
    popular: false,
    icon: "calendar-outline" as const,
  },
  {
    id: "yearly",
    label: "YILLIK",
    price: "₺799",
    period: "/yıl",
    priceNote: "₺66/ay — %55 tasarruf",
    popular: true,
    icon: "trophy-outline" as const,
  },
];

const FEATURES = [
  { icon: "infinite-outline", text: "Sınırsız AI koşu koçluğu" },
  { icon: "calendar-outline", text: "Sınırsız program erteleme" },
  { icon: "notifications-outline", text: "Akıllı antrenman bildirimleri" },
];

// ============================================================
// PREMIUM EKRANI
// ============================================================
export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { getValidToken, refreshUserData } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
        body: JSON.stringify({ premium_type: selectedPlan }),
      });

      if (res.ok) {
        setSuccess(true);
        await refreshUserData();
        setTimeout(() => {
          router.back();
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
      ? "AI Token Limitin Doldu"
      : reason === "feature"
        ? "Premium Özellik"
        : "PaceUp Premium";

  const subText =
    reason === "token_limit"
      ? "Ücretsiz kullanım hakkın bitti. Premium'a geç, sınırsız AI koçluğun tadını çıkar."
      : "Koşu hedeflerine ulaşmak için tüm özelliklerin kilidini aç.";

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {/* Handle */}
      <View style={styles.handle} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{headerText}</Text>
          <Text style={styles.headerSub}>{subText}</Text>
        </View>

        {/* Özellikler */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresSectionTitle}>Neler Dahil?</Text>
          {FEATURES.map((f, i) => (
            <View
              key={f.text}
              style={[styles.featureRow, i === FEATURES.length - 1 && { marginBottom: 0 }]}
            >
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={16} color={colors.accent} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
              <Ionicons name="checkmark" size={16} color={colors.success} />
            </View>
          ))}
        </View>

        {/* Plan Kartları */}
        <Text style={styles.planSectionTitle}>Plan Seç</Text>
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

                <View style={[styles.planIconWrap, isSelected && styles.planIconWrapSelected]}>
                  <Ionicons
                    name={plan.icon}
                    size={18}
                    color={isSelected ? colors.accent : colors.text.secondary}
                  />
                </View>

                <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                  {plan.label}
                </Text>

                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {plan.price}
                  </Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>

                <Text style={[styles.planNote, isSelected && { color: colors.accent }]}>
                  {plan.priceNote}
                </Text>

                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
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
            <ActivityIndicator color={colors.text.inverse} />
          ) : success ? (
            <View style={styles.ctaBtnInner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.text.inverse} />
              <Text style={styles.ctaBtnText}>Premium Aktif!</Text>
            </View>
          ) : (
            <View style={styles.ctaBtnInner}>
              <Ionicons name="flash" size={18} color={colors.text.inverse} />
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
          İstediğin zaman iptal edebilirsin
        </Text>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: c.border,
      borderRadius: 2,
      alignSelf: "center" as const,
      marginTop: 8,
      marginBottom: 4,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },

    // Header
    header: {
      alignItems: "center" as const,
      paddingVertical: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800" as const,
      color: c.text.primary,
      textAlign: "center" as const,
      marginBottom: 8,
    },
    headerSub: {
      fontSize: 14,
      color: c.text.secondary,
      textAlign: "center" as const,
      lineHeight: 20,
      paddingHorizontal: 10,
    },

    // Features
    featuresCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    featuresSectionTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 14,
    },
    featureRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: 12,
    },
    featureIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.accent + "15",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 12,
    },
    featureText: {
      color: c.text.primary,
      fontSize: 14,
      flex: 1,
      lineHeight: 20,
    },

    // Plans
    planSectionTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 12,
    },
    plansRow: {
      flexDirection: "row" as const,
      gap: 12,
      marginBottom: 24,
    },
    planCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      position: "relative" as const,
      overflow: "hidden" as const,
    },
    planCardSelected: {
      borderColor: c.accent,
      backgroundColor: c.accent + "08",
    },
    popularBadge: {
      backgroundColor: c.accent,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      alignSelf: "flex-start" as const,
      marginBottom: 10,
    },
    popularBadgeText: {
      color: c.text.inverse,
      fontSize: 9,
      fontWeight: "800" as const,
      letterSpacing: 0.8,
    },
    planIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: 10,
    },
    planIconWrapSelected: {
      backgroundColor: c.accent + "15",
    },
    planLabel: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: c.text.secondary,
      letterSpacing: 1,
      marginBottom: 6,
    },
    planLabelSelected: {
      color: c.accent,
    },
    planPriceRow: {
      flexDirection: "row" as const,
      alignItems: "baseline" as const,
      gap: 2,
    },
    planPrice: {
      fontSize: 24,
      fontWeight: "800" as const,
      color: c.text.primary,
    },
    planPriceSelected: {
      color: c.accent,
    },
    planPeriod: {
      fontSize: 12,
      color: c.text.secondary,
    },
    planNote: {
      fontSize: 11,
      color: c.text.secondary,
      marginTop: 4,
      lineHeight: 14,
    },
    radioOuter: {
      position: "absolute" as const,
      top: 12,
      right: 12,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    radioOuterSelected: {
      borderColor: c.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.accent,
    },

    // CTA
    ctaBtn: {
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 12,
    },
    ctaBtnInner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    ctaBtnText: {
      color: c.text.inverse,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 0.3,
    },

    // Footer
    footerNote: {
      color: c.text.secondary,
      fontSize: 12,
      textAlign: "center" as const,
      marginBottom: 4,
    },
  } as const;
};
