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
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const PlansScreen = () => {
    const { token } = useContext(AuthContext);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- 1. VERİ ÇEKME ---
    const fetchPlans = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/programs/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setUserPlans(data);
            }
        } catch (error) {
            console.log("Fetch plans error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPlans();
        }, [token])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPlans();
        setRefreshing(false);
    };

    // --- 2. AKSİYONLAR ---

    // A) Plan Silme
    const handleDeletePlan = (planId: string) => {
        Alert.alert(
            "Planı Sil",
            "Bu planı kalıcı olarak silmek istediğinize emin misiniz?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Sil",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await fetch(
                                `${API_URL}/programs/${planId}/`,
                                {
                                    method: "DELETE",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );
                            if (response.ok) {
                                setUserPlans((prev) =>
                                    prev.filter((p) => p.id !== planId)
                                );
                            } else {
                                Alert.alert("Hata", "Plan silinemedi.");
                            }
                        } catch (error) {
                            Alert.alert("Hata", "Sunucu hatası.");
                        }
                    },
                },
            ]
        );
    };

    // B) Plan Aktifleştirme (Arşiv -> Aktif)
    const handleActivatePlan = (plan: any) => {
        Alert.alert(
            "Planı Seç",
            `"${plan.title}" planını aktif duruma getirmek istiyor musun? Şu anki aktif planın arşive (inactive) kaldırılacak.`,
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Evet, Seç",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const response = await fetch(
                                `${API_URL}/programs/${plan.id}/activate/`,
                                {
                                    method: "POST",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                    },
                                }
                            );

                            if (response.ok) {
                                await fetchPlans();
                                Alert.alert("Başarılı", "Plan aktif edildi.");
                            } else {
                                Alert.alert("Hata", "Plan değiştirilemedi.");
                            }
                        } catch (error) {
                            Alert.alert("Hata", "Sunucu hatası.");
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // C) Plan Pasife Alma (Aktif -> Arşiv) -- YENİ EKLENDİ
    const handleDeactivatePlan = (plan: any) => {
        Alert.alert(
            "Planı Durdur",
            `"${plan.title}" planını arşive kaldırmak istiyor musun? Şu an aktif bir planın olmayacak.`,
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Evet, Arşivle",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            // Standart PATCH isteği ile status: inactive yapıyoruz
                            const response = await fetch(
                                `${API_URL}/programs/${plan.id}/`,
                                {
                                    method: "PATCH",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        status: "inactive",
                                    }),
                                }
                            );

                            if (response.ok) {
                                await fetchPlans();
                                Alert.alert("Bilgi", "Plan arşive kaldırıldı.");
                            } else {
                                Alert.alert("Hata", "Plan güncellenemedi.");
                            }
                        } catch (error) {
                            Alert.alert("Hata", "Sunucu hatası.");
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // D) Navigasyonlar
    const handleEditPlan = (plan: any) => {
        router.push({
            pathname: "/(protected)/(tabs)/plans/chatbot_modal",
            params: { planId: plan.id, planTitle: plan.title },
        });
    };

    const handleCreatePlan = () => {
        router.push("/(protected)/(tabs)/plans/chatbot");
    };

    // --- 3. UI YARDIMCILARI ---
    const getStatusInfo = (status: string) => {
        switch (status) {
            case "active":
                return { color: COLORS.success, text: "Aktif", icon: "flash" };
            case "completed":
                return {
                    color: "#2196F3",
                    text: "Tamamlandı",
                    icon: "checkmark-circle",
                };
            case "inactive":
                return {
                    color: COLORS.textDim,
                    text: "Pasif / Arşiv",
                    icon: "archive",
                };
            default:
                return {
                    color: COLORS.textDim,
                    text: "Pasif",
                    icon: "archive",
                };
        }
    };

    const getDifficultyInfo = (difficulty: string) => {
        switch (difficulty) {
            case "beginner":
                return {
                    text: "Başlangıç",
                    icon: "fitness",
                    color: COLORS.success,
                };
            case "intermediate":
                return {
                    text: "Orta",
                    icon: "speedometer",
                    color: COLORS.warning,
                };
            case "advanced":
                return { text: "İleri", icon: "rocket", color: COLORS.danger };
            default:
                return {
                    text: difficulty,
                    icon: "help",
                    color: COLORS.textDim,
                };
        }
    };

    // --- 4. KART RENDER ---
    const renderPlanCard = (plan: any) => {
        const statusInfo = getStatusInfo(plan.status);
        const difficultyInfo = getDifficultyInfo(plan.difficulty);
        const isActive = plan.status === "active";
        const isInactive =
            plan.status === "inactive" || plan.status === "cancelled";

        // İlerleme Hesabı
        const progress =
            plan.progress_percent !== undefined
                ? plan.progress_percent
                : plan.total_workouts_count > 0
                ? Math.round(
                      (plan.completed_workouts_count /
                          plan.total_workouts_count) *
                          100
                  )
                : 0;

        return (
            <View
                key={plan.id}
                style={[styles.planCard, isInactive && styles.inactiveCard]}
            >
                {/* Header: Badge'ler ve Silme Butonu */}
                <View style={styles.cardHeader}>
                    <View style={styles.badgesRow}>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: statusInfo.color + "20" },
                            ]}
                        >
                            <Ionicons
                                name={statusInfo.icon as any}
                                size={14}
                                color={statusInfo.color}
                            />
                            <Text
                                style={[
                                    styles.badgeText,
                                    { color: statusInfo.color },
                                ]}
                            >
                                {statusInfo.text}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.difficultyBadge,
                                { borderColor: difficultyInfo.color },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.difficultyText,
                                    { color: difficultyInfo.color },
                                ]}
                            >
                                {difficultyInfo.text}
                            </Text>
                        </View>
                    </View>

                    {/* Sadece aktif olmayan planlar silinebilsin */}
                    {!isActive && (
                        <Pressable
                            onPress={() => handleDeletePlan(plan.id)}
                            style={styles.deleteIcon}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color={COLORS.textDim}
                            />
                        </Pressable>
                    )}
                </View>

                {/* Başlık ve Açıklama */}
                <Text
                    style={[
                        styles.planTitle,
                        isInactive && { color: COLORS.textDim },
                    ]}
                >
                    {plan.title}
                </Text>
                <Text style={styles.planDesc} numberOfLines={2}>
                    {plan.description}
                </Text>

                {/* İstatistikler */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={COLORS.textDim}
                        />
                        <Text style={styles.statText}>
                            {plan.duration_weeks} Hafta
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons
                            name="fitness-outline"
                            size={14}
                            color={COLORS.textDim}
                        />
                        <Text style={styles.statText}>
                            {plan.workouts_per_week} ant/hafta
                        </Text>
                    </View>
                </View>

                {/* İlerleme Çubuğu */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>İlerleme</Text>
                        <Text style={styles.progressValue}>{progress}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progress}%`,
                                    backgroundColor: statusInfo.color,
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressSubtext}>
                        {plan.completed_workouts_count} /{" "}
                        {plan.total_workouts_count} antrenman
                    </Text>
                </View>

                {/* Butonlar */}
                <View style={styles.actionRow}>
                    {/* Detay Butonu */}
                    <Pressable
                        style={styles.actionButton}
                        onPress={() => handleEditPlan(plan)}
                    >
                        <Ionicons
                            name="create-outline"
                            size={18}
                            color={isInactive ? COLORS.textDim : COLORS.text}
                        />
                        <Text
                            style={[
                                styles.actionButtonText,
                                isInactive && { color: COLORS.textDim },
                            ]}
                        >
                            Detay / Sohbet
                        </Text>
                    </Pressable>

                    <View style={styles.verticalDivider} />

                    {/* Durum Butonları */}
                    {isActive ? (
                        // YENİ: Aktif planı Pasife çekme butonu
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => handleDeactivatePlan(plan)}
                        >
                            <Ionicons
                                name="pause-circle-outline"
                                size={18}
                                color="#FFA726"
                            />
                            <Text
                                style={[
                                    styles.actionButtonText,
                                    { color: "#FFA726" },
                                ]}
                            >
                                Pasife Al
                            </Text>
                        </Pressable>
                    ) : plan.status === "completed" ? (
                        <View style={styles.actionButton}>
                            <Ionicons
                                name="trophy-outline"
                                size={18}
                                color="#2196F3"
                            />
                            <Text
                                style={[
                                    styles.actionButtonText,
                                    { color: "#2196F3" },
                                ]}
                            >
                                Tamamlandı
                            </Text>
                        </View>
                    ) : (
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => handleActivatePlan(plan)}
                        >
                            <Ionicons
                                name="play-circle-outline"
                                size={18}
                                color={COLORS.accent}
                            />
                            <Text
                                style={[
                                    styles.actionButtonText,
                                    { color: COLORS.accent },
                                ]}
                            >
                                Bu Planı Seç
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    const activePlans = userPlans.filter((p) => p.status === "active");
    const completedPlans = userPlans.filter((p) => p.status === "completed");
    const inactivePlans = userPlans.filter(
        (p) => p.status === "inactive" || p.status === "cancelled"
    );

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.accent}
                    />
                }
            >
                {/* Create Button */}
                <Pressable onPress={handleCreatePlan}>
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.createButton}
                    >
                        <View style={styles.createIconBg}>
                            <Ionicons
                                name="add"
                                size={24}
                                color={COLORS.accent}
                            />
                        </View>
                        <View style={styles.createTextContainer}>
                            <Text style={styles.createTitle}>
                                Yeni Plan Oluştur
                            </Text>
                            <Text style={styles.createSubtitle}>
                                AI Koçunla hedefine ulaş
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={24}
                            color="white"
                        />
                    </LinearGradient>
                </Pressable>

                {/* 1. AKTİF PLAN */}
                {activePlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aktif Plan</Text>
                        {activePlans.map(renderPlanCard)}
                    </View>
                )}

                {/* 2. TAMAMLANANLAR */}
                {completedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Tamamlananlar</Text>
                        {completedPlans.map(renderPlanCard)}
                    </View>
                )}

                {/* 3. GEÇMİŞ / ARŞİV */}
                {inactivePlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Arşiv / Pasif Planlar
                        </Text>
                        <View style={{ opacity: 0.8 }}>
                            {inactivePlans.map(renderPlanCard)}
                        </View>
                    </View>
                )}

                {/* EMPTY STATE */}
                {userPlans.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="clipboard-outline"
                            size={64}
                            color={COLORS.textDim}
                        />
                        <Text style={styles.emptyTitle}>
                            Henüz Bir Planın Yok
                        </Text>
                        <Text style={styles.emptyText}>
                            Yeni bir plan oluşturarak antrenmanlara başla!
                        </Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

export default PlansScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { justifyContent: "center", alignItems: "center" },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20 },

    inactiveCard: {
        backgroundColor: "#1E1E1E",
        borderColor: "#333",
    },

    createButton: {
        flexDirection: "row",
        alignItems: "center",
        padding: 20,
        borderRadius: 20,
        marginBottom: 30,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    createIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 15,
    },
    createTextContainer: { flex: 1 },
    createTitle: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    createSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13 },

    section: { marginBottom: 25 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 15,
        paddingLeft: 5,
    },

    planCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    badgesRow: { flexDirection: "row", gap: 8 },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    badgeText: { fontSize: 12, fontWeight: "700" },
    difficultyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    difficultyText: { fontSize: 11, fontWeight: "600" },
    deleteIcon: { padding: 5 },

    planTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 6,
    },
    planDesc: {
        color: COLORS.textDim,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },

    statsGrid: { flexDirection: "row", gap: 15, marginBottom: 15 },
    statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    statText: { color: COLORS.textDim, fontSize: 12 },

    progressContainer: { marginBottom: 15 },
    progressLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    progressLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },
    progressValue: { color: COLORS.text, fontSize: 12, fontWeight: "bold" },
    progressBarBg: {
        height: 6,
        backgroundColor: COLORS.background,
        borderRadius: 3,
        marginBottom: 6,
    },
    progressBarFill: { height: "100%", borderRadius: 3 },
    progressSubtext: { color: COLORS.textDim, fontSize: 11 },

    actionRow: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.1)",
        paddingTop: 15,
        justifyContent: "space-evenly",
        alignItems: "center",
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        padding: 5,
    },
    actionButtonText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
    verticalDivider: {
        width: 1,
        height: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
    },

    emptyState: { alignItems: "center", marginTop: 50, padding: 20 },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 20,
        marginBottom: 10,
    },
    emptyText: { color: COLORS.textDim, fontSize: 14, textAlign: "center" },
});
