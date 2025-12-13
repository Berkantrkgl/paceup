import { Ionicons } from "@expo/vector-icons";
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
import { AuthContext } from "@/utils/authContext";

// API URL
const API_URL = "http://127.0.0.1:8000/api";

const PlansScreen = () => {
    const { token } = useContext(AuthContext);
    const [userPlans, setUserPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- VERİ ÇEKME FONKSİYONU ---
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

    // Sayfa her odaklandığında veriyi yenile (örn: yeni plan ekleyip dönünce)
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

    // --- PLAN SİLME ---
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
                                // Listeden çıkar
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

    // --- PLAN DURAKLATMA / DEVAM ETTİRME ---
    const handleTogglePause = async (plan: any) => {
        const newStatus = plan.status === "active" ? "paused" : "active";

        // Optimistik Güncelleme (Hemen arayüzde göster)
        const oldPlans = [...userPlans];
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

            if (!response.ok) {
                // Hata varsa geri al
                setUserPlans(oldPlans);
                Alert.alert("Hata", "Durum güncellenemedi.");
            }
        } catch (error) {
            setUserPlans(oldPlans);
        }
    };

    const handleEditPlan = (plan: any) => {
        router.push({
            pathname: "/chatbot_modal",
            params: { planId: plan.id, planTitle: plan.title },
        });
    };

    // --- HELPERLAR ---
    const getStatusColor = (status: string) => {
        switch (status) {
            case "active":
                return "#4CAF50";
            case "completed":
                return "#2196F3";
            case "paused":
                return "#FFA726";
            default:
                return "#B0B0B0";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "active":
                return "Aktif";
            case "completed":
                return "Tamamlandı";
            case "paused":
                return "Duraklatıldı";
            default:
                return status;
        }
    };

    const getDifficultyText = (difficulty: string) => {
        switch (difficulty) {
            case "beginner":
                return "Başlangıç";
            case "intermediate":
                return "Orta";
            case "advanced":
                return "İleri";
            default:
                return difficulty;
        }
    };

    const getDifficultyIcon = (difficulty: string): any => {
        switch (difficulty) {
            case "beginner":
                return "fitness-outline";
            case "intermediate":
                return "speedometer-outline";
            case "advanced":
                return "rocket-outline";
            default:
                return "help-outline";
        }
    };

    // Kategorilere Ayır
    const activePlans = userPlans.filter((p) => p.status === "active");
    const completedPlans = userPlans.filter((p) => p.status === "completed");
    const pausedPlans = userPlans.filter((p) => p.status === "paused");

    if (isLoading) {
        return (
            <View
                style={[
                    styles.container,
                    { justifyContent: "center", alignItems: "center" },
                ]}
            >
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

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
                {/* Header Stats */}
                <View style={styles.headerSection}>
                    <Text style={styles.headerTitle}>Antrenman Planlarım</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Ionicons name="flash" size={20} color="#4CAF50" />
                            <Text style={styles.statValue}>
                                {activePlans.length}
                            </Text>
                            <Text style={styles.statLabel}>Aktif</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color="#2196F3"
                            />
                            <Text style={styles.statValue}>
                                {completedPlans.length}
                            </Text>
                            <Text style={styles.statLabel}>Tamamlandı</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Ionicons
                                name="pause-circle"
                                size={20}
                                color="#FFA726"
                            />
                            <Text style={styles.statValue}>
                                {pausedPlans.length}
                            </Text>
                            <Text style={styles.statLabel}>Duraklatıldı</Text>
                        </View>
                    </View>
                </View>

                {/* Create New Plan Button */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.createPlanButton}
                        onPress={() => router.push("/chatbot")}
                    >
                        <View style={styles.createPlanIcon}>
                            <Ionicons
                                name="add-circle"
                                size={32}
                                color="white"
                            />
                        </View>
                        <View style={styles.createPlanContent}>
                            <Text style={styles.createPlanTitle}>
                                Yeni Plan Oluştur
                            </Text>
                            <Text style={styles.createPlanDescription}>
                                AI koçunla yeni bir antrenman planı oluştur
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={24}
                            color="white"
                        />
                    </Pressable>
                </View>

                {/* Active Plans */}
                {activePlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Aktif Planlar</Text>
                        {activePlans.map((plan) => (
                            <View key={plan.id} style={styles.planCard}>
                                {/* Header */}
                                <View style={styles.planHeader}>
                                    <View style={styles.planHeaderLeft}>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor:
                                                        getStatusColor(
                                                            plan.status
                                                        ),
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={styles.statusBadgeText}
                                            >
                                                {getStatusText(plan.status)}
                                            </Text>
                                        </View>
                                        <View style={styles.difficultyBadge}>
                                            <Ionicons
                                                name={getDifficultyIcon(
                                                    plan.difficulty
                                                )}
                                                size={14}
                                                color={COLORS.accent}
                                            />
                                            <Text style={styles.difficultyText}>
                                                {getDifficultyText(
                                                    plan.difficulty
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            handleDeletePlan(plan.id)
                                        }
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={22}
                                            color="#FF6B6B"
                                        />
                                    </Pressable>
                                </View>

                                <Text style={styles.planTitle}>
                                    {plan.title}
                                </Text>
                                <Text style={styles.planDescription}>
                                    {plan.description}
                                </Text>

                                <View style={styles.planGoal}>
                                    <Ionicons
                                        name="flag"
                                        size={18}
                                        color={COLORS.accent}
                                    />
                                    <Text style={styles.planGoalText}>
                                        Hedef: {plan.goal}
                                    </Text>
                                </View>

                                {/* Progress */}
                                <View style={styles.progressSection}>
                                    <View style={styles.progressInfo}>
                                        <Text style={styles.progressText}>
                                            Hafta {plan.current_week}/
                                            {plan.duration_weeks}
                                        </Text>
                                        <Text style={styles.progressPercentage}>
                                            {plan.total_workouts_count > 0
                                                ? Math.round(
                                                      (plan.completed_workouts_count /
                                                          plan.total_workouts_count) *
                                                          100
                                                  )
                                                : 0}
                                            %
                                        </Text>
                                    </View>
                                    <View style={styles.progressBarContainer}>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                {
                                                    width: `${
                                                        (plan.completed_workouts_count /
                                                            Math.max(
                                                                plan.total_workouts_count,
                                                                1
                                                            )) *
                                                        100
                                                    }%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.workoutsText}>
                                        {plan.completed_workouts_count}/
                                        {plan.total_workouts_count} antrenman
                                        tamamlandı
                                    </Text>
                                </View>

                                {/* Info Grid */}
                                <View style={styles.planInfoGrid}>
                                    <View style={styles.planInfoItem}>
                                        <Ionicons
                                            name="calendar-outline"
                                            size={16}
                                            color="#B0B0B0"
                                        />
                                        <Text style={styles.planInfoText}>
                                            {plan.duration_weeks} Hafta
                                        </Text>
                                    </View>
                                    <View style={styles.planInfoItem}>
                                        <Ionicons
                                            name="fitness-outline"
                                            size={16}
                                            color="#B0B0B0"
                                        />
                                        <Text style={styles.planInfoText}>
                                            {plan.workouts_per_week} ant/hafta
                                        </Text>
                                    </View>
                                </View>

                                {/* Actions */}
                                <View style={styles.actionButtons}>
                                    <Pressable
                                        style={styles.editButton}
                                        onPress={() => handleEditPlan(plan)}
                                    >
                                        <Ionicons
                                            name="create-outline"
                                            size={20}
                                            color="white"
                                        />
                                        <Text style={styles.editButtonText}>
                                            Düzenle
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        style={styles.pauseButton}
                                        onPress={() => handleTogglePause(plan)}
                                    >
                                        <Ionicons
                                            name="pause-outline"
                                            size={20}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.pauseButtonText}>
                                            Duraklat
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Paused Plans */}
                {pausedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Duraklatılan Planlar
                        </Text>
                        {pausedPlans.map((plan) => (
                            <View
                                key={plan.id}
                                style={[styles.planCard, styles.pausedCard]}
                            >
                                <View style={styles.planHeader}>
                                    <View style={styles.planHeaderLeft}>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor:
                                                        getStatusColor(
                                                            plan.status
                                                        ),
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={styles.statusBadgeText}
                                            >
                                                {getStatusText(plan.status)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            handleDeletePlan(plan.id)
                                        }
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={22}
                                            color="#FF6B6B"
                                        />
                                    </Pressable>
                                </View>

                                <Text style={styles.planTitle}>
                                    {plan.title}
                                </Text>
                                <Text style={styles.planDescription}>
                                    {plan.description}
                                </Text>

                                <View style={styles.actionButtons}>
                                    <Pressable
                                        style={styles.editButton}
                                        onPress={() => handleTogglePause(plan)}
                                    >
                                        <Ionicons
                                            name="play-outline"
                                            size={20}
                                            color="white"
                                        />
                                        <Text style={styles.editButtonText}>
                                            Devam Et
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={styles.pauseButton}
                                        onPress={() => handleEditPlan(plan)}
                                    >
                                        <Ionicons
                                            name="create-outline"
                                            size={20}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.pauseButtonText}>
                                            Düzenle
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Completed Plans */}
                {completedPlans.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Tamamlanan Planlar
                        </Text>
                        {completedPlans.map((plan) => (
                            <View
                                key={plan.id}
                                style={[styles.planCard, styles.completedCard]}
                            >
                                <View style={styles.planHeader}>
                                    <View style={styles.planHeaderLeft}>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor:
                                                        getStatusColor(
                                                            plan.status
                                                        ),
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="checkmark"
                                                size={14}
                                                color="white"
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text
                                                style={styles.statusBadgeText}
                                            >
                                                {getStatusText(plan.status)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Pressable
                                        onPress={() =>
                                            handleDeletePlan(plan.id)
                                        }
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={22}
                                            color="#FF6B6B"
                                        />
                                    </Pressable>
                                </View>

                                <Text style={styles.planTitle}>
                                    {plan.title}
                                </Text>
                                <Text style={styles.planDescription}>
                                    {plan.description}
                                </Text>

                                <View style={styles.completedInfo}>
                                    <Ionicons
                                        name="trophy"
                                        size={24}
                                        color="#FFD93D"
                                    />
                                    <Text style={styles.completedText}>
                                        {plan.total_workouts_count} antrenmanı
                                        başarıyla tamamladın!
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Empty State */}
                {userPlans.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="clipboard-outline"
                            size={80}
                            color="#666"
                        />
                        <Text style={styles.emptyStateTitle}>
                            Henüz Plan Yok
                        </Text>
                        <Text style={styles.emptyStateDescription}>
                            AI koçunla hemen yeni bir antrenman planı oluştur!
                        </Text>
                        <Pressable
                            style={styles.emptyStateButton}
                            onPress={() => router.push("/chatbot")}
                        >
                            <Text style={styles.emptyStateButtonText}>
                                Plan Oluştur
                            </Text>
                        </Pressable>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default PlansScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },

    // Header Section
    headerSection: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 20,
        paddingVertical: 25,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        marginBottom: 20,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 20,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        color: "#B0B0B0",
        fontSize: 12,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },

    // Section
    section: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 15,
    },

    // Create Plan Button
    createPlanButton: {
        backgroundColor: COLORS.accent,
        borderRadius: 15,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    createPlanIcon: {
        marginRight: 15,
    },
    createPlanContent: {
        flex: 1,
    },
    createPlanTitle: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    createPlanDescription: {
        color: "rgba(255, 255, 255, 0.8)",
        fontSize: 13,
    },

    // Plan Card
    planCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    pausedCard: {
        opacity: 0.8,
    },
    completedCard: {
        borderWidth: 2,
        borderColor: "#2196F3",
    },
    planHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
    },
    planHeaderLeft: {
        flexDirection: "row",
        gap: 10,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    statusBadgeText: {
        color: "white",
        fontSize: 12,
        fontWeight: "bold",
    },
    difficultyBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    difficultyText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: "600",
    },
    planTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 8,
    },
    planDescription: {
        color: "#B0B0B0",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 15,
    },
    planGoal: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginBottom: 15,
    },
    planGoalText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },

    // Progress
    progressSection: {
        marginBottom: 15,
    },
    progressInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    progressText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },
    progressPercentage: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: COLORS.background,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 8,
    },
    progressBar: {
        height: "100%",
        backgroundColor: COLORS.accent,
        borderRadius: 4,
    },
    workoutsText: {
        color: "#B0B0B0",
        fontSize: 12,
    },

    // Plan Info Grid
    planInfoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 15,
        marginBottom: 15,
    },
    planInfoItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    planInfoText: {
        color: "#B0B0B0",
        fontSize: 12,
    },

    // Completed Info
    completedInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(255, 217, 61, 0.15)",
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
    },
    completedText: {
        flex: 1,
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },

    // Action Buttons
    actionButtons: {
        flexDirection: "row",
        gap: 12,
    },
    editButton: {
        flex: 1,
        backgroundColor: COLORS.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    editButtonText: {
        color: "white",
        fontSize: 15,
        fontWeight: "bold",
    },
    pauseButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.accent,
        gap: 8,
    },
    pauseButtonText: {
        color: COLORS.accent,
        fontSize: 15,
        fontWeight: "bold",
    },

    // Empty State
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyStateTitle: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginTop: 20,
        marginBottom: 10,
    },
    emptyStateDescription: {
        color: "#B0B0B0",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 30,
    },
    emptyStateButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
    },
    emptyStateButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
});
