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
    const { getValidToken, refreshUserData } = useContext(AuthContext);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPlans = async () => {
        const validToken = await getValidToken();
        if (!validToken) return;
        try {
            const response = await fetch(`${API_URL}/programs/`, {
                headers: { Authorization: `Bearer ${validToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                const plansArray = Array.isArray(data)
                    ? data
                    : data.results || [];
                setUserPlans(plansArray);
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
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPlans();
        if (refreshUserData) await refreshUserData();
        setRefreshing(false);
    };

    const handleOpenDetails = (plan: any) => {
        router.push({
            pathname: "/(protected)/(tabs)/plans/plan_details",
            params: { planId: plan.id },
        });
    };

    const handleActivatePlan = (plan: any) => {
        Alert.alert("Planı Aktifleştir", `"${plan.title}" aktif edilsin mi?`, [
            { text: "Vazgeç", style: "cancel" },
            {
                text: "Evet",
                onPress: async () => {
                    setIsLoading(true);
                    const validToken = await getValidToken();
                    const res = await fetch(
                        `${API_URL}/programs/${plan.id}/activate/`,
                        {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${validToken}`,
                            },
                        }
                    );
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
                    const validToken = await getValidToken();
                    const res = await fetch(
                        `${API_URL}/programs/${plan.id}/`,
                        {
                            method: "PATCH",
                            headers: {
                                Authorization: `Bearer ${validToken}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ status: "inactive" }),
                        }
                    );
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
                    const validToken = await getValidToken();
                    const res = await fetch(
                        `${API_URL}/programs/${planId}/`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${validToken}`,
                            },
                        }
                    );
                    if (res.ok)
                        setUserPlans((prev) =>
                            prev.filter((p) => p.id !== planId)
                        );
                },
            },
        ]);
    };

    const activePlans = userPlans.filter((p) => p.status === "active");
    const archivedPlans = userPlans.filter((p) => p.status !== "active");

    const renderActivePlan = (plan: any) => {
        const progress =
            Math.round(
                (plan.completed_workouts_count / plan.total_workouts_count) *
                    100
            ) || 0;

        return (
            <Pressable
                key={plan.id}
                onPress={() => handleOpenDetails(plan)}
                style={({ pressed }) => [
                    styles.activePlanCard,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
            >
                {/* Header */}
                <View style={styles.activePlanHeader}>
                    <View style={styles.activeBadge}>
                        <Ionicons
                            name="flash"
                            size={12}
                            color={COLORS.success}
                        />
                        <Text style={styles.activeBadgeText}>Aktif</Text>
                    </View>
                    <View style={styles.weekBadge}>
                        <Text style={styles.weekBadgeText}>
                            Hafta {plan.current_week || 1} /{" "}
                            {plan.duration_weeks || "—"}
                        </Text>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.activePlanTitle}>{plan.title}</Text>
                {plan.description ? (
                    <Text style={styles.activePlanDesc} numberOfLines={2}>
                        {plan.description}
                    </Text>
                ) : null}

                {/* Progress */}
                <View style={styles.progressSection}>
                    <View style={styles.progressRow}>
                        <Text style={styles.progressPercent}>%{progress}</Text>
                        <Text style={styles.progressLabel}>
                            {plan.completed_workouts_count || 0} /{" "}
                            {plan.total_workouts_count || 0} antrenman
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <LinearGradient
                            colors={[COLORS.accent, COLORS.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                                styles.progressBarFill,
                                { width: `${Math.min(progress, 100)}%` },
                            ]}
                        />
                    </View>
                </View>

                {/* Action */}
                <Pressable
                    style={styles.activePlanAction}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeactivatePlan(plan);
                    }}
                >
                    <Ionicons
                        name="pause-circle-outline"
                        size={16}
                        color={COLORS.textDim}
                    />
                    <Text style={styles.activePlanActionText}>
                        Arşive Kaldır
                    </Text>
                </Pressable>
            </Pressable>
        );
    };

    const renderArchivedPlan = (plan: any) => {
        const progress =
            Math.round(
                (plan.completed_workouts_count / plan.total_workouts_count) *
                    100
            ) || 0;

        return (
            <Pressable
                key={plan.id}
                onPress={() => handleOpenDetails(plan)}
                style={({ pressed }) => [
                    styles.archivedPlanCard,
                    pressed && { opacity: 0.8 },
                ]}
            >
                <View style={styles.archivedPlanLeft}>
                    <View style={styles.archivedIconBox}>
                        <Ionicons
                            name="archive-outline"
                            size={18}
                            color={COLORS.textDim}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.archivedPlanTitle} numberOfLines={1}>
                            {plan.title}
                        </Text>
                        <Text style={styles.archivedPlanMeta}>
                            %{progress} tamamlandı
                        </Text>
                    </View>
                </View>
                <View style={styles.archivedActions}>
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation?.();
                            handleActivatePlan(plan);
                        }}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="play-circle-outline"
                            size={22}
                            color={COLORS.accent}
                        />
                    </Pressable>
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation?.();
                            handleDeletePlan(plan.id);
                        }}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={20}
                            color={COLORS.danger}
                        />
                    </Pressable>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
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
                {/* HEADER */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Planlama</Text>
                    <Text style={styles.headerSubtitle}>
                        Programlarını yönet ve yeni plan oluştur
                    </Text>
                </View>

                {/* AI CREATE BUTTON */}
                <Pressable
                    onPress={() =>
                        router.push("/(protected)/(tabs)/plans/chatbot")
                    }
                    style={({ pressed }) => [
                        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                >
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.aiCard}
                    >
                        <View style={styles.aiCardLeft}>
                            <View style={styles.aiIconBox}>
                                <Ionicons
                                    name="sparkles"
                                    size={24}
                                    color={COLORS.white}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.aiCardTitle}>
                                    Yeni Plan Oluştur
                                </Text>
                                <Text style={styles.aiCardDesc}>
                                    AI koçun sana özel program hazırlasın
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color="rgba(255,255,255,0.6)"
                        />
                    </LinearGradient>
                </Pressable>

                {/* ACTIVE PLANS */}
                {activePlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aktif Program</Text>
                        {activePlans.map(renderActivePlan)}
                    </View>
                )}

                {/* ARCHIVED PLANS */}
                {archivedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Arşiv</Text>
                        <View style={styles.archivedList}>
                            {archivedPlans.map(renderArchivedPlan)}
                        </View>
                    </View>
                )}

                {/* EMPTY STATE */}
                {!isLoading && userPlans.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="map-outline"
                            size={48}
                            color={COLORS.inactive}
                        />
                        <Text style={styles.emptyTitle}>
                            Henüz bir planın yok
                        </Text>
                        <Text style={styles.emptyDesc}>
                            Yapay zeka koçunla tanış ve hedefine uygun
                            programını oluştur.
                        </Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

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
    scrollContent: { padding: 20, paddingTop: 70 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },

    // HEADER
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: COLORS.textDim,
        fontSize: 14,
        marginTop: 4,
    },

    // AI CARD
    aiCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 18,
        borderRadius: 20,
        marginBottom: 28,
    },
    aiCardLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 14,
    },
    aiIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    aiCardTitle: {
        color: COLORS.white,
        fontSize: 17,
        fontWeight: "800",
    },
    aiCardDesc: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        marginTop: 2,
    },

    // SECTION
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 12,
    },

    // ACTIVE PLAN CARD
    activePlanCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    activePlanHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    activeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: COLORS.success + "15",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    activeBadgeText: {
        color: COLORS.success,
        fontSize: 11,
        fontWeight: "700",
    },
    weekBadge: {
        backgroundColor: COLORS.cardVariant,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    weekBadgeText: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "600",
    },
    activePlanTitle: {
        color: COLORS.text,
        fontSize: 19,
        fontWeight: "700",
        marginBottom: 4,
    },
    activePlanDesc: {
        color: COLORS.textDim,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
    },

    // PROGRESS
    progressSection: {
        marginBottom: 16,
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    progressPercent: {
        color: COLORS.accent,
        fontSize: 15,
        fontWeight: "800",
    },
    progressLabel: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "500",
    },
    progressBarBg: {
        height: 6,
        backgroundColor: COLORS.background,
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        borderRadius: 3,
    },

    // ACTIVE PLAN ACTION
    activePlanAction: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
    },
    activePlanActionText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
    },

    // ARCHIVED PLAN
    archivedList: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: "hidden",
    },
    archivedPlanCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    archivedPlanLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    archivedIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.cardVariant,
        alignItems: "center",
        justifyContent: "center",
    },
    archivedPlanTitle: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },
    archivedPlanMeta: {
        color: COLORS.textDim,
        fontSize: 11,
        marginTop: 2,
    },
    archivedActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },

    // EMPTY STATE
    emptyState: {
        alignItems: "center",
        paddingVertical: 48,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginTop: 16,
    },
    emptyDesc: {
        color: COLORS.textDim,
        fontSize: 13,
        textAlign: "center",
        marginTop: 6,
        lineHeight: 20,
        paddingHorizontal: 40,
    },
});
