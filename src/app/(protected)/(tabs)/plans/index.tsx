import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";
import { PlanDetailsModal } from "./plan_details";
import { RescheduleModal } from "./reschedule_modal";

const PlansScreen = () => {
  // AuthContext'ten user ve veriyi tazelemek için refreshUserData'yı da alıyoruz
  const { token, user, refreshUserData } = useContext(AuthContext);
  const [userPlans, setUserPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Kota Bilgileri (Backend'deki isimlerle eşleşmeli)
  const remainingReschedules = user?.remaining_reschedules ?? 0;
  const isPremium = user?.is_premium ?? false;

  // Modal State'leri
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<any>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // Reschedule State'leri
  const [reschedulePlan, setReschedulePlan] = useState<any>(null);
  const [isRescheduleModalVisible, setIsRescheduleModalVisible] =
    useState(false);

  // --- 1. VERİ ÇEKME ---
  const fetchPlans = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/programs/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // DRF Pagination kontrolü: data bir obje ise ve results varsa onu al, yoksa data'nın kendisini al.
        const plansArray = Array.isArray(data) ? data : data.results || [];
        setUserPlans(plansArray);
      } else {
        const err = await response.text();
        console.log("Backend error on fetch:", err);
      }
    } catch (error) {
      console.log("Fetch plans network error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, [token]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPlans();
    if (refreshUserData) await refreshUserData(); // Refresh yaparken kullanıcı kotasını da tazeleyelim
    setRefreshing(false);
  };

  // --- 2. AKSİYONLAR ---

  const handleOpenDetails = async (plan: any) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/programs/${plan.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPlanDetails(data);
        setIsDetailModalVisible(true);
      }
    } catch (error) {
      Alert.alert("Hata", "Plan detayları yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivatePlan = (plan: any) => {
    Alert.alert("Planı Seç", `"${plan.title}" aktif edilsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Evet",
        onPress: async () => {
          setIsLoading(true);
          const res = await fetch(`${API_URL}/programs/${plan.id}/activate/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) await fetchPlans();
          setIsLoading(false);
        },
      },
    ]);
  };

  const handleDeactivatePlan = (plan: any) => {
    Alert.alert("Durdur", "Bu plan arşive kaldırılsın mı?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Evet",
        onPress: async () => {
          setIsLoading(true);
          const res = await fetch(`${API_URL}/programs/${plan.id}/`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "inactive" }),
          });
          if (res.ok) await fetchPlans();
          setIsLoading(false);
        },
      },
    ]);
  };

  const handleDeletePlan = (planId: string) => {
    Alert.alert("Sil", "Bu plan tamamen silinecek?", [
      { text: "İptal" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const res = await fetch(`${API_URL}/programs/${planId}/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok)
            setUserPlans((prev) => prev.filter((p) => p.id !== planId));
        },
      },
    ]);
  };

  // --- YENİ: ERTELEME AKSİYONLARI (KOTA KONTROLLÜ) ---
  const handleOpenReschedule = (plan: any) => {
    // Kota Kontrolü
    if (!isPremium && remainingReschedules <= 0) {
      Alert.alert(
        "Erteleme Hakkı Doldu",
        "Bu ayki erteleme hakkınızı doldurdunuz. Sınırsız planlama esnekliği için Premium'a geçebilirsiniz.",
        [
          { text: "Vazgeç", style: "cancel" },
          // İleride Premium ekranın varsa buraya router.push yönlendirmesi eklenebilir
          { text: "Tamam", style: "default" },
        ],
      );
      return;
    }

    setReschedulePlan(plan);
    setIsRescheduleModalVisible(true);
  };

  const onRescheduleConfirm = async (newStartDate: string) => {
    if (!reschedulePlan) return;
    setIsRescheduleModalVisible(false);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/programs/${reschedulePlan.id}/reschedule/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ start_date: newStartDate }),
        },
      );

      if (response.ok) {
        Alert.alert("Başarılı", "Programınız yeni tarihe göre güncellendi.");
        await fetchPlans();

        // İşlem başarılıysa global User state'i tazeleyerek kotanın (Ertele (1) vs) güncellenmesini sağla
        if (refreshUserData) {
          await refreshUserData();
        }
      } else {
        const err = await response.json();
        Alert.alert(
          "Hata",
          err.error || err.detail || "Güncelleme yapılamadı.",
        );
      }
    } catch (error) {
      Alert.alert("Hata", "Sunucu hatası.");
    } finally {
      setIsLoading(false);
      setReschedulePlan(null);
    }
  };

  // --- 3. UI RENDER ---
  const renderPlanCard = (plan: any) => {
    const isActive = plan.status === "active";
    const isInactive =
      plan.status === "inactive" || plan.status === "cancelled";
    const progress =
      Math.round(
        (plan.completed_workouts_count / plan.total_workouts_count) * 100,
      ) || 0;

    // Erteleme butonu durumu
    const isOutOfQuota = !isPremium && remainingReschedules <= 0;
    const quotaText = isPremium ? "" : ` (${remainingReschedules})`;

    return (
      <Pressable
        key={plan.id}
        onPress={() => handleOpenDetails(plan)}
        style={({ pressed }) => [
          styles.planCard,
          isInactive && styles.inactiveCard,
          pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? COLORS.success + "20" : "#333" },
              ]}
            >
              <Ionicons
                name={isActive ? "flash" : "archive"}
                size={12}
                color={isActive ? COLORS.success : COLORS.textDim}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: isActive ? COLORS.success : COLORS.textDim },
                ]}
              >
                {isActive ? "Aktif" : "Arşiv"}
              </Text>
            </View>
          </View>
          {!isActive && (
            <Pressable
              onPress={() => handleDeletePlan(plan.id)}
              style={styles.deleteIcon}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.textDim} />
            </Pressable>
          )}
        </View>

        <Text
          style={[styles.planTitle, isInactive && { color: COLORS.textDim }]}
        >
          {plan.title}
        </Text>
        <Text style={styles.planDesc} numberOfLines={2}>
          {plan.description}
        </Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progress}%`,
                  backgroundColor: isActive ? COLORS.accent : COLORS.textDim,
                },
              ]}
            />
          </View>
          <Text style={styles.progressSubtext}>%{progress} tamamlandı</Text>
        </View>

        {/* Butonlar Alt Kısım */}
        <View style={styles.actionRow}>
          {/* ERTELE BUTONU (KOTA KONTROLLÜ) */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOpenReschedule(plan)}
          >
            <Ionicons
              name={isOutOfQuota ? "lock-closed-outline" : "calendar-outline"}
              size={16}
              color={isOutOfQuota ? COLORS.textDim : COLORS.text}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: isOutOfQuota ? COLORS.textDim : COLORS.text },
              ]}
            >
              Ertele{quotaText}
            </Text>
          </TouchableOpacity>

          <View style={styles.verticalDivider} />

          {isActive ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeactivatePlan(plan)}
            >
              <Ionicons name="pause-circle-outline" size={16} color="#FFA726" />
              <Text style={[styles.actionButtonText, { color: "#FFA726" }]}>
                Durdur
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleActivatePlan(plan)}
            >
              <Ionicons
                name="play-circle-outline"
                size={16}
                color={COLORS.accent}
              />
              <Text style={[styles.actionButtonText, { color: COLORS.accent }]}>
                Aktifleştir
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        <Pressable
          onPress={() => router.push("/(protected)/(tabs)/plans/chatbot")}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButton}
          >
            <Ionicons name="add-circle" size={28} color="white" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.createTitle}>Yeni Plan Oluştur</Text>
              <Text style={styles.createSubtitle}>
                AI Pacer senin için hazırlasın
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        {userPlans.filter((p) => p.status === "active").length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aktif Plan</Text>
            {userPlans.filter((p) => p.status === "active").map(renderPlanCard)}
          </View>
        )}

        {userPlans.filter((p) => p.status !== "active").length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Geçmiş ve Diğerleri</Text>
            {userPlans.filter((p) => p.status !== "active").map(renderPlanCard)}
          </View>
        )}
      </ScrollView>

      {/* Plan Detay Modalı */}
      <PlanDetailsModal
        visible={isDetailModalVisible}
        onClose={() => setIsDetailModalVisible(false)}
        plan={selectedPlanDetails}
      />

      {/* YENİ: Reschedule Modalı */}
      <RescheduleModal
        visible={isRescheduleModalVisible}
        onClose={() => setIsRescheduleModalVisible(false)}
        onConfirm={onRescheduleConfirm}
        planTitle={reschedulePlan?.title || ""}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      )}
    </View>
  );
};

export default PlansScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    marginBottom: 30,
  },
  createTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  createSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    opacity: 0.6,
  },
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  inactiveCard: { opacity: 0.7, backgroundColor: "#1A1A1A" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badgesRow: { flexDirection: "row", gap: 6 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  deleteIcon: { padding: 4 },
  planTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  planDesc: {
    color: COLORS.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  progressContainer: { marginBottom: 20 },
  progressBarBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
  },
  progressBarFill: { height: "100%", borderRadius: 2 },
  progressSubtext: { color: COLORS.textDim, fontSize: 11, marginTop: 6 },
  actionRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 16,
    justifyContent: "space-between",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  actionButtonText: { fontSize: 13, fontWeight: "600" },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
