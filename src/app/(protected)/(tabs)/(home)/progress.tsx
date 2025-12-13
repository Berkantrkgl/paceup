import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

// EMULATOR İÇİN: 127.0.0.1, FİZİKSEL CİHAZ İÇİN: BİLGİSAYAR IP'Sİ
const API_URL = "http://127.0.0.1:8000/api";

const ProgressScreen = () => {
    const { user, token, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);

    // Initial Data (Boş grafik hatasını önlemek için default değerler)
    const [chartData, setChartData] = useState<number[]>([0]);
    const [chartLabels, setChartLabels] = useState<string[]>(["-"]);
    const [paceHistory, setPaceHistory] = useState<number[]>([0]);

    const [summaryStats, setSummaryStats] = useState({
        total_distance: 0,
        total_workouts: 0,
        total_duration_mins: 0,
        calories_burned: 0,
        current_streak: 0,
        days_active: 1,
    });

    const [activeProgram, setActiveProgram] = useState<any>(null);
    const [recentAchievements, setRecentAchievements] = useState<any[]>([]);

    const fetchStatsData = async () => {
        if (!token) return;

        try {
            // 1. ÖZET VERİLER (HERO KARTLARI)
            const summaryRes = await fetch(`${API_URL}/stats/summary/`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!summaryRes.ok) {
                // HATA VARSA HTML'İ KONSOLA BAS (DEBUG İÇİN)
                const errorText = await summaryRes.text();
                console.error("Summary API Error:", errorText.slice(0, 500));
                return;
            }
            const summaryJson = await summaryRes.json();
            setSummaryStats(summaryJson);

            // 2. GRAFİK VERİLERİ
            const chartRes = await fetch(
                `${API_URL}/stats/charts/?period=week`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            if (chartRes.ok) {
                const chartJson = await chartRes.json();

                if (chartJson.datasets[0].data.length > 0) {
                    setChartData(chartJson.datasets[0].data);
                    setChartLabels(chartJson.labels);
                    setPaceHistory(chartJson.pace_data);
                }
            }

            // 3. PROGRAM DETAYI
            const progRes = await fetch(`${API_URL}/stats/program/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (progRes.ok) {
                const progJson = await progRes.json();
                setActiveProgram(progJson);
            }

            // 4. BAŞARIMLAR
            const achRes = await fetch(`${API_URL}/achievements/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (achRes.ok) {
                const achJson = await achRes.json();
                setRecentAchievements(achJson.slice(0, 3));
            }
        } catch (error) {
            console.log("General Fetch Error:", error);
        }
    };

    useEffect(() => {
        fetchStatsData();
    }, [token]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUserData();
        await fetchStatsData();
        setRefreshing(false);
    }, []);

    // --- CHART CONFIG ---
    const chartConfig = {
        backgroundColor: COLORS.card,
        backgroundGradientFrom: COLORS.card,
        backgroundGradientTo: COLORS.card,
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: { borderRadius: 16 },
        propsForDots: { r: "4", strokeWidth: "2", stroke: COLORS.accent },
    };

    // Zaman Formatlama (dk -> saat dk)
    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours}sa ${mins}dk`;
        return `${mins}dk`;
    };

    // Program İlerleme Yüzdesi
    const progPercent = activeProgram?.progress_percent || 0;

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
                {/* Hero Stats */}
                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>İlerleme Özeti</Text>
                    <Text style={styles.heroSubtitle}>
                        {activeProgram?.has_active_program
                            ? activeProgram.title
                            : "Genel İstatistikler"}
                    </Text>

                    <View style={styles.heroStatsContainer}>
                        <View style={styles.heroStatCard}>
                            <View style={styles.heroStatIconContainer}>
                                <Ionicons
                                    name="flame"
                                    size={32}
                                    color="#FF6B6B"
                                />
                            </View>
                            <Text style={styles.heroStatValue}>
                                {summaryStats.days_active}
                            </Text>
                            <Text style={styles.heroStatLabel}>Gün Aktif</Text>
                        </View>

                        <View style={styles.heroStatCard}>
                            <View style={styles.heroStatIconContainer}>
                                <Ionicons
                                    name="navigate"
                                    size={32}
                                    color="#4ECDC4"
                                />
                            </View>
                            <Text style={styles.heroStatValue}>
                                {summaryStats.total_distance}
                            </Text>
                            <Text style={styles.heroStatLabel}>Toplam KM</Text>
                        </View>

                        <View style={styles.heroStatCard}>
                            <View style={styles.heroStatIconContainer}>
                                <Ionicons
                                    name="trophy"
                                    size={32}
                                    color="#FFD93D"
                                />
                            </View>
                            <Text style={styles.heroStatValue}>
                                {summaryStats.total_workouts}
                            </Text>
                            <Text style={styles.heroStatLabel}>Antrenman</Text>
                        </View>
                    </View>
                </View>

                {/* Program Progress (Varsa Göster) */}
                {activeProgram?.has_active_program && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Program İlerlemesi
                        </Text>
                        <View style={styles.card}>
                            <View style={styles.progressHeader}>
                                <View style={styles.progressInfo}>
                                    <Text style={styles.progressWeek}>
                                        Hafta {activeProgram.current_week}/
                                        {activeProgram.total_weeks}
                                    </Text>
                                    <Text style={styles.progressPercentage}>
                                        {progPercent}% Tamamlandı
                                    </Text>
                                </View>
                                <View style={styles.progressCircle}>
                                    <Text style={styles.progressCircleText}>
                                        {progPercent}%
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.progressBarContainer}>
                                <View
                                    style={[
                                        styles.progressBar,
                                        { width: `${progPercent}%` },
                                    ]}
                                />
                            </View>

                            <View style={styles.workoutStats}>
                                <View style={styles.workoutStat}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={20}
                                        color="#4CAF50"
                                    />
                                    <Text style={styles.workoutStatText}>
                                        {activeProgram.completed_workouts}{" "}
                                        Tamamlandı
                                    </Text>
                                </View>
                                <View style={styles.workoutStat}>
                                    <Ionicons
                                        name="time-outline"
                                        size={20}
                                        color="#FFA726"
                                    />
                                    <Text style={styles.workoutStatText}>
                                        {activeProgram.remaining_workouts} Kaldı
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Distance Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Haftalık Mesafe</Text>
                    <View style={styles.card}>
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={{
                                    labels: chartLabels,
                                    datasets: [{ data: chartData }],
                                }}
                                width={Dimensions.get("window").width - 80}
                                height={200}
                                chartConfig={chartConfig}
                                bezier
                                style={styles.chart}
                            />
                        </View>
                    </View>
                </View>

                {/* Pace Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Tempo Analizi (dk/km)
                    </Text>
                    <View style={styles.card}>
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={{
                                    labels: chartLabels,
                                    datasets: [
                                        {
                                            data: paceHistory,
                                            color: (opacity = 1) =>
                                                `rgba(76, 175, 80, ${opacity})`,
                                        },
                                    ],
                                }}
                                width={Dimensions.get("window").width - 80}
                                height={200}
                                chartConfig={{
                                    ...chartConfig,
                                    color: (opacity = 1) =>
                                        `rgba(76, 175, 80, ${opacity})`,
                                    propsForDots: {
                                        r: "4",
                                        strokeWidth: "2",
                                        stroke: "#4CAF50",
                                    },
                                }}
                                bezier
                                style={styles.chart}
                            />
                        </View>
                    </View>
                </View>

                {/* Other Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Diğer İstatistikler</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Ionicons
                                name="time"
                                size={28}
                                color={COLORS.accent}
                            />
                            <Text style={styles.statCardValue}>
                                {formatTime(summaryStats.total_duration_mins)}
                            </Text>
                            <Text style={styles.statCardLabel}>
                                Toplam Süre
                            </Text>
                        </View>

                        <View style={styles.statCard}>
                            <Ionicons name="flash" size={28} color="#FF6B6B" />
                            <Text style={styles.statCardValue}>
                                {summaryStats.current_streak}
                            </Text>
                            <Text style={styles.statCardLabel}>
                                Günlük Seri
                            </Text>
                        </View>

                        <View style={styles.statCard}>
                            <Ionicons name="flame" size={28} color="#FFA726" />
                            <Text style={styles.statCardValue}>
                                {summaryStats.calories_burned}
                            </Text>
                            <Text style={styles.statCardLabel}>Kalori</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Ionicons name="star" size={28} color="#FFD93D" />
                            <Text style={styles.statCardValue}>
                                {user?.longest_streak || 0}
                            </Text>
                            <Text style={styles.statCardLabel}>
                                En Uzun Seri
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Achievements */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Son Başarılar</Text>
                    <View style={styles.achievementsContainer}>
                        {recentAchievements.length > 0 ? (
                            recentAchievements.map((ach) => (
                                <View
                                    key={ach.id}
                                    style={styles.achievementCard}
                                >
                                    <View style={styles.achievementIcon}>
                                        <Ionicons
                                            name={
                                                (ach.icon_name as any) ||
                                                "trophy"
                                            }
                                            size={32}
                                            color={ach.icon_color || "#FFD93D"}
                                        />
                                    </View>
                                    <View style={styles.achievementContent}>
                                        <Text style={styles.achievementTitle}>
                                            {ach.title}
                                        </Text>
                                        <Text
                                            style={
                                                styles.achievementDescription
                                            }
                                        >
                                            {ach.description}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.achievementCard}>
                                <View
                                    style={[
                                        styles.achievementIcon,
                                        { backgroundColor: "#333" },
                                    ]}
                                >
                                    <Ionicons
                                        name="lock-closed"
                                        size={32}
                                        color="#666"
                                    />
                                </View>
                                <View style={styles.achievementContent}>
                                    <Text
                                        style={[
                                            styles.achievementTitle,
                                            { color: "#888" },
                                        ]}
                                    >
                                        Henüz Başarım Yok
                                    </Text>
                                    <Text style={styles.achievementDescription}>
                                        Antrenman yaparak rozet kazan!
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default ProgressScreen;

// Styles aynen kalabilir
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    heroSection: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 20,
        paddingVertical: 30,
        borderRadius: 30,
        marginBottom: 20,
    },
    heroTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 5,
    },
    heroSubtitle: { color: "#B0B0B0", fontSize: 14, marginBottom: 25 },
    heroStatsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 15,
    },
    heroStatCard: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 15,
        padding: 15,
        alignItems: "center",
    },
    heroStatIconContainer: { marginBottom: 10 },
    heroStatValue: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 5,
    },
    heroStatLabel: { color: "#B0B0B0", fontSize: 12 },
    section: { paddingHorizontal: 20, marginBottom: 25 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 15,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
    },
    progressInfo: { flex: 1 },
    progressWeek: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 5,
    },
    progressPercentage: { color: "#B0B0B0", fontSize: 14 },
    progressCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.background,
        borderWidth: 4,
        borderColor: COLORS.accent,
        justifyContent: "center",
        alignItems: "center",
    },
    progressCircleText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: "bold",
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: COLORS.background,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 15,
    },
    progressBar: {
        height: "100%",
        backgroundColor: COLORS.accent,
        borderRadius: 4,
    },
    workoutStats: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.1)",
    },
    workoutStat: { flexDirection: "row", alignItems: "center", gap: 8 },
    workoutStatText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
    chartContainer: { alignItems: "center" },
    chartTitle: {
        color: "#B0B0B0",
        fontSize: 14,
        marginBottom: 15,
        textAlign: "center",
    },
    chart: { borderRadius: 16 },
    paceStats: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 25,
    },
    paceStatItem: { flex: 1, alignItems: "center" },
    paceStatLabel: {
        color: "#B0B0B0",
        fontSize: 12,
        marginTop: 8,
        marginBottom: 8,
    },
    paceStatValue: { color: COLORS.text, fontSize: 28, fontWeight: "bold" },
    paceStatUnit: { color: "#B0B0B0", fontSize: 12, marginTop: 4 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 15 },
    statCard: {
        flex: 1,
        minWidth: "45%",
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    statCardValue: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginTop: 10,
        marginBottom: 5,
    },
    statCardLabel: { color: "#B0B0B0", fontSize: 12, textAlign: "center" },
    achievementsContainer: { gap: 12 },
    achievementCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 15,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    achievementIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 15,
    },
    achievementContent: { flex: 1 },
    achievementTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 4,
    },
    achievementDescription: { color: "#B0B0B0", fontSize: 13 },
});
