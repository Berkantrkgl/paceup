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
import { API_URL } from "@/constants/Config"; // Ensure correct import
import { AuthContext } from "@/utils/authContext";

const PlansScreen = () => {
    const { token } = useContext(AuthContext);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- FETCH DATA ---
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

    // --- ACTIONS ---
    const handleDeletePlan = (planId: string) => {
        Alert.alert(
            "Planı Sil",
            "Bu planı ve tüm antrenman geçmişini silmek istediğinize emin misiniz?",
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

    const handleTogglePause = async (plan: any) => {
        const newStatus = plan.status === "active" ? "paused" : "active";
        const oldPlans = [...userPlans];

        // Optimistic update
        setUserPlans((prev) =>
            prev.map((p) =>
                p.id === plan.id ? { ...p, status: newStatus } : p
            )
        );

        try {
            const response = await fetch(`${API_URL}/programs/${plan.id}/`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) throw new Error("Update failed");
        } catch (error) {
            setUserPlans(oldPlans); // Revert on error
            Alert.alert("Hata", "Durum güncellenemedi.");
        }
    };

    const handleEditPlan = (plan: any) => {
        router.push({
            pathname: "/(protected)/(tabs)/plans/chatbot_modal",
            params: { planId: plan.id, planTitle: plan.title },
        });
    };

    const handleCreatePlan = () => {
        router.push("/(protected)/(tabs)/plans/chatbot");
    };

    // --- HELPERS ---
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
            case "paused":
                return {
                    color: "#FFA726",
                    text: "Duraklatıldı",
                    icon: "pause-circle",
                };
            case "cancelled":
                return {
                    color: COLORS.danger,
                    text: "İptal Edildi",
                    icon: "close-circle",
                };
            default:
                return {
                    color: COLORS.textDim,
                    text: status,
                    icon: "help-circle",
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

    // --- RENDER HELPERS ---
    const renderPlanCard = (plan: any) => {
        const statusInfo = getStatusInfo(plan.status);
        const difficultyInfo = getDifficultyInfo(plan.difficulty);

        // Use the backend-calculated progress_percent if available, fallback to manual calc
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
                style={[
                    styles.planCard,
                    plan.status === "paused" && styles.pausedCard,
                ]}
            >
                {/* Header Row */}
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
                </View>

                {/* Title & Desc */}
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planDesc} numberOfLines={2}>
                    {plan.description}
                </Text>

                {/* Goal */}
                <View style={styles.goalRow}>
                    <Ionicons
                        name="flag-outline"
                        size={16}
                        color={COLORS.textDim}
                    />
                    <Text style={styles.goalText}>{plan.goal}</Text>
                </View>

                {/* Stats Row (Duration & Frequency) */}
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

                {/* Progress Bar */}
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
                        {plan.total_workouts_count} antrenman •{" "}
                        {plan.current_week_calculated
                            ? `${plan.current_week_calculated}. Hafta`
                            : "Planlanıyor"}
                    </Text>
                </View>

                {/* Actions (Only for Active/Paused) */}
                {plan.status !== "completed" && plan.status !== "cancelled" && (
                    <View style={styles.actionRow}>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => handleEditPlan(plan)}
                        >
                            <Ionicons
                                name="create-outline"
                                size={18}
                                color={COLORS.text}
                            />
                            <Text style={styles.actionButtonText}>Düzenle</Text>
                        </Pressable>
                        <View style={styles.verticalDivider} />
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => handleTogglePause(plan)}
                        >
                            <Ionicons
                                name={
                                    plan.status === "active"
                                        ? "pause-outline"
                                        : "play-outline"
                                }
                                size={18}
                                color={COLORS.text}
                            />
                            <Text style={styles.actionButtonText}>
                                {plan.status === "active"
                                    ? "Duraklat"
                                    : "Devam Et"}
                            </Text>
                        </Pressable>
                    </View>
                )}
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
    const pausedPlans = userPlans.filter((p) => p.status === "paused");
    const completedPlans = userPlans.filter((p) => p.status === "completed");

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
                {/* CREATE NEW BUTTON */}
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

                {/* ACTIVE PLANS */}
                {activePlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aktif Planlar</Text>
                        {activePlans.map(renderPlanCard)}
                    </View>
                )}

                {/* PAUSED PLANS */}
                {pausedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Duraklatılan Planlar
                        </Text>
                        {pausedPlans.map(renderPlanCard)}
                    </View>
                )}

                {/* COMPLETED PLANS */}
                {completedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Tamamlanan Geçmiş
                        </Text>
                        {completedPlans.map(renderPlanCard)}
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

    // CREATE BUTTON
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

    // SECTIONS
    section: { marginBottom: 25 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 15,
        paddingLeft: 5,
    },

    // PLAN CARD
    planCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    pausedCard: { opacity: 0.7 },
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

    goalRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
    },
    goalText: { color: COLORS.textDim, fontSize: 13, fontStyle: "italic" },

    statsGrid: { flexDirection: "row", gap: 15, marginBottom: 15 },
    statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    statText: { color: COLORS.textDim, fontSize: 12 },

    // PROGRESS
    progressContainer: { marginBottom: 20 },
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

    // ACTIONS
    actionRow: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
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
        backgroundColor: COLORS.cardBorder,
    },

    // EMPTY STATE
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
