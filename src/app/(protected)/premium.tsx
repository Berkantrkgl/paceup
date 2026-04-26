import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";
import {
  getPremiumPackages,
  purchasePackage,
  restorePurchases,
} from "@/utils/revenuecat";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============================================================
// PLAN METADATA
// ============================================================
type PlanMeta = {
  id: "monthly" | "yearly";
  label: string;
  period: string;
  priceNote: string;
  popular: boolean;
  icon: "calendar-outline" | "trophy-outline";
};

const PLAN_META: Record<"monthly" | "yearly", PlanMeta> = {
  monthly: {
    id: "monthly",
    label: "AYLIK",
    period: "/ay",
    priceNote: "Her ay otomatik yenilenir",
    popular: false,
    icon: "calendar-outline",
  },
  yearly: {
    id: "yearly",
    label: "YILLIK",
    period: "/yıl",
    priceNote: "Her yıl otomatik yenilenir",
    popular: true,
    icon: "trophy-outline",
  },
};

const LEGAL_BASE_URL = "https://legal.your-domain.com";
const PRIVACY_URL = `${LEGAL_BASE_URL}/privacy.html`;
const TERMS_URL = `${LEGAL_BASE_URL}/terms.html`;

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
  const { user, getValidToken, refreshUserData } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);

  const loadOfferings = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const { monthly, annual } = await getPremiumPackages();
      // Her iki paket de null ise: RC offerings boş, dashboard kurulumu eksik.
      // Hata gibi gösterip kullanıcıyı bekletmeyelim.
      if (!monthly && !annual) {
        setPackagesError(
          "Şu an abonelik planları yüklenemiyor. Lütfen birkaç dakika sonra tekrar dene.",
        );
        return;
      }
      setMonthlyPkg(monthly);
      setAnnualPkg(annual);
    } catch (e) {
      console.warn("[Premium] offerings fetch hatası:", e);
      setPackagesError(
        "Bağlantı hatası. İnternetini kontrol edip tekrar dene.",
      );
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const notifyBackend = async (productId?: string) => {
    const validToken = await getValidToken();
    if (!validToken) return;
    try {
      await fetch(`${API_URL}/users/verify_purchase/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify(productId ? { product_id: productId } : {}),
      });
    } catch (e) {
      console.warn("[Premium] verify_purchase hatası:", e);
    }
    await refreshUserData();
  };

  const handlePurchase = async () => {
    const pkg = selectedPlan === "yearly" ? annualPkg : monthlyPkg;
    if (!pkg) {
      Alert.alert("Hata", "Paket bilgisi yüklenemedi. Tekrar dene.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Hata", "Oturum bilgisi yüklenemedi. Tekrar giriş yap.");
      return;
    }

    setLoading(true);
    try {
      const { isPremium } = await purchasePackage(pkg, user.id);
      if (isPremium) {
        await notifyBackend(pkg.product.identifier);
        setSuccess(true);
        setTimeout(() => router.back(), 1800);
      } else {
        Alert.alert(
          "Hata",
          "Satın alma tamamlandı ama premium erişim açılamadı. Destek ile iletişime geç.",
        );
      }
    } catch (e: any) {
      if (e?.userCancelled) {
        // Kullanıcı iptal etti, sessizce geç
      } else {
        // RC SDK exception fırlatmış olabilir ama satın alma backend'e
        // webhook ile düşmüş olabilir (sandbox TRANSFER edge case). Backend'i
        // teyit edelim — eğer premium aktifse başarı say.
        await notifyBackend(pkg.product.identifier);
        await refreshUserData();
        // refreshUserData sonrası user.is_premium yeni değeri gösteriyor mu
        // diye küçük bir gecikme ile kontrol ediyoruz (state propagation).
        await new Promise((r) => setTimeout(r, 300));
        // user state stale olabilir, doğrudan API'den çek:
        const validToken = await getValidToken();
        let confirmedPremium = false;
        if (validToken) {
          try {
            const res = await fetch(`${API_URL}/users/me/`, {
              headers: { Authorization: `Bearer ${validToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              confirmedPremium = !!data.is_premium;
            }
          } catch {}
        }
        if (confirmedPremium) {
          setSuccess(true);
          setTimeout(() => router.back(), 1800);
        } else {
          Alert.alert(
            "Satın Alma Başarısız",
            e?.message || "Bilinmeyen bir hata oluştu.",
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!user?.id) {
      Alert.alert("Hata", "Oturum bilgisi yüklenemedi. Tekrar giriş yap.");
      return;
    }
    setRestoring(true);
    try {
      const { customerInfo, isPremium } = await restorePurchases(user.id);
      if (isPremium) {
        const activeProductId =
          customerInfo.entitlements.active["premium"]?.productIdentifier;
        await notifyBackend(activeProductId);
        Alert.alert("Başarılı", "Aboneliğin geri yüklendi.");
        setTimeout(() => router.back(), 800);
      } else {
        Alert.alert(
          "Aktif Abonelik Yok",
          "Bu Apple ID ile aktif bir PaceUp Premium aboneliği bulunamadı.",
        );
      }
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Geri yükleme başarısız.");
    } finally {
      setRestoring(false);
    }
  };

  const priceFor = (p: "monthly" | "yearly"): string => {
    const pkg = p === "yearly" ? annualPkg : monthlyPkg;
    return pkg?.product.priceString ?? "—";
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
        {packagesLoading ? (
          <View style={styles.packagesLoading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : packagesError ? (
          <View style={styles.packagesError}>
            <Ionicons
              name="cloud-offline-outline"
              size={28}
              color={colors.text.secondary}
            />
            <Text style={styles.packagesErrorText}>{packagesError}</Text>
            <TouchableOpacity
              onPress={loadOfferings}
              style={styles.retryBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.plansRow}>
            {(["monthly", "yearly"] as const).map((planId) => {
              const plan = PLAN_META[planId];
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
                      {priceFor(plan.id)}
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
        )}

        {/* CTA Butonu */}
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            (loading || success || packagesLoading || !!packagesError) && {
              opacity: 0.5,
            },
          ]}
          onPress={handlePurchase}
          disabled={
            loading || success || packagesLoading || !!packagesError
          }
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

        {/* Restore */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring || loading}
          style={styles.restoreBtn}
        >
          {restoring ? (
            <ActivityIndicator color={colors.text.secondary} size="small" />
          ) : (
            <Text style={styles.restoreText}>Satın Alımları Geri Yükle</Text>
          )}
        </TouchableOpacity>

        {/* Alt not — Apple Guideline 3.1.2 disclosure */}
        <Text style={styles.disclosureText}>
          Abonelik, mevcut dönemin sona ermesinden en az 24 saat önce iptal
          edilmediği takdirde otomatik olarak yenilenir. Yenileme ücreti, dönem
          sonundan 24 saat önce Apple ID hesabından tahsil edilir.
          {"\n\n"}
          İptal etmek için: App Store → Ayarlar → Apple ID → Abonelikler.
        </Text>

        <View style={styles.legalLinksRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLinkText}>Kullanım Koşulları</Text>
          </TouchableOpacity>
          <Text style={styles.legalLinkSeparator}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLinkText}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </View>
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

    packagesLoading: {
      paddingVertical: 40,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 24,
    },
    packagesError: {
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 24,
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    packagesErrorText: {
      color: c.text.secondary,
      fontSize: 13,
      textAlign: "center" as const,
      lineHeight: 18,
    },
    retryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.accent,
      marginTop: 4,
    },
    retryBtnText: {
      color: c.accent,
      fontSize: 13,
      fontWeight: "600" as const,
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
    restoreBtn: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 12,
      marginBottom: 4,
    },
    restoreText: {
      color: c.text.secondary,
      fontSize: 13,
      fontWeight: "600" as const,
      textDecorationLine: "underline" as const,
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

    // Footer — Apple subscription disclosure
    disclosureText: {
      color: c.text.secondary,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center" as const,
      marginTop: 8,
      marginBottom: 16,
      opacity: 0.8,
    },
    legalLinksRow: {
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 8,
      marginBottom: 8,
    },
    legalLinkText: {
      color: c.text.secondary,
      fontSize: 12,
      textDecorationLine: "underline" as const,
    },
    legalLinkSeparator: {
      color: c.text.secondary,
      fontSize: 12,
      opacity: 0.5,
    },
  } as const;
};
