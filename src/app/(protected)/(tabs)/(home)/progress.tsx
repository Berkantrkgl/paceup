import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

const ProgressScreen = () => {
    const { user, getValidToken, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeChart, setActiveChart] = useState<"distance" | "pace">("distance");

    const WEEK_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    const [weeklyDistance, setWeeklyDistance] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weeklyPace, setWeeklyPace] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

    const [summaryStats, setSummaryStats] = useState({
        total_distance: 0,
        total_workouts: 0,
        total_duration_mins: 0,
        calories_burned: 0,
        current_streak: 0,
        days_active: 1,
        weekly_progress: 0,
    });

    const [activeProgram, setActiveProgram] = useState<any>(null);
    const [recentAchievements, setRecentAchievements] = useState<any[]>([]);

    const fetchStatsData = async () => {
        const validToken = await getValidToken();
        if (!validToken) return;

        try {
            const [summaryRes, workoutsRes, progRes, achRes] = await Promise.all([
                fetch(`${API_URL}/stats/summary/`, {
                    headers: { Authorization: `Bearer ${validToken}` },
                }),
                fetch(`${API_URL}/workouts/?only_active=true`, {
                    headers: { Authorization: `Bearer ${validToken}` },
                }),
                fetch(`${API_URL}/stats/program/`, {
                    headers: { Authorization: `Bearer ${validToken}` },
                }),
                fetch(`${API_URL}/achievements/`, {
                    headers: { Authorization: `Bearer ${validToken}` },
                }),
            ]);

            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummaryStats(data);
            }

            if (workoutsRes.ok) {
                const json = await workoutsRes.json();
                const workouts = Array.isArray(json) ? json : json.results || [];

                // Bu haftanın Pazartesi'sini bul
                const today = new Date();
                const dow = (today.getDay() + 6) % 7; // 0=Pzt, 6=Paz
                const monday = new Date(today);
                monday.setDate(today.getDate() - dow);
                monday.setHours(0, 0, 0, 0);

                const dist = [0, 0, 0, 0, 0, 0, 0];
                const pace = [0, 0, 0, 0, 0, 0, 0];

                workouts.forEach((w: any) => {
                    if (w.status !== "completed" || !w.result) return;
                    // "YYYY-MM-DD" → timezone-safe parse
                    const parts = w.scheduled_date.split("-");
                    const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                    const diffDays = Math.round((d.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays < 7) {
                        dist[diffDays] = w.result.actual_distance || 0;
                        const duration = w.result.actual_duration || 0;
                        const distance = w.result.actual_distance || 0;
                        pace[diffDays] = distance > 0 ? duration / distance : 0; // dk/km
                    }
                });

                setWeeklyDistance(dist);
                setWeeklyPace(pace);
            }

            if (progRes.ok) {
                const data = await progRes.json();
                setActiveProgram(data);
            }

            if (achRes.ok) {
                const data = await achRes.json();
                setRecentAchievements(data.slice(0, 3));
            }
        } catch (error) {
            console.log("Stats Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatsData();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUserData();
        await fetchStatsData();
        setRefreshing(false);
    }, []);

    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours}sa ${mins}dk`;
        return `${mins}dk`;
    };

    const formatPace = (seconds: number | null | undefined) => {
        if (!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const progPercent = activeProgram?.progress_percent || 0;

    const distanceBarChartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: COLORS.card,
        backgroundGradientTo: COLORS.card,
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(255, 69, 1, ${opacity})`,
        labelColor: () => COLORS.textDim,
        barPercentage: 0.5,
        propsForBackgroundLines: {
            strokeDasharray: "",
            stroke: COLORS.cardBorder,
            strokeOpacity: 0.3,
        },
        fillShadowGradient: COLORS.accent,
        fillShadowGradientOpacity: 1,
    };

    const paceBarChartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: COLORS.card,
        backgroundGradientTo: COLORS.card,
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(40, 199, 111, ${opacity})`,
        labelColor: () => COLORS.textDim,
        barPercentage: 0.5,
        propsForBackgroundLines: {
            strokeDasharray: "",
            stroke: COLORS.cardBorder,
            strokeOpacity: 0.3,
        },
        fillShadowGradient: COLORS.success,
        fillShadowGradientOpacity: 1,
    };

    if (loading && !refreshing) {
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
                        colors={[COLORS.accent]}
                        progressViewOffset={40}
                    />
                }
            >
                {/* HERO HEADER */}
                <View style={styles.heroHeader}>
                    {/* HERO STAT — Toplam Mesafe */}
                    <View style={styles.heroStatRow}>
                        <View style={styles.heroStatMain}>
                            <Text style={styles.heroStatValue}>
                                {summaryStats.total_distance}
                            </Text>
                            <Text style={styles.heroStatUnit}>km</Text>
                        </View>
                        <Text style={styles.heroStatLabel}>Toplam Mesafe</Text>
                    </View>

                    {/* MINI STATS */}
                    <View style={styles.miniStatsRow}>
                        <View style={styles.miniStat}>
                            <View
                                style={[
                                    styles.miniStatIcon,
                                    { backgroundColor: COLORS.secondary + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="flame"
                                    size={16}
                                    color={COLORS.secondary}
                                />
                            </View>
                            <Text style={styles.miniStatValue}>
                                {summaryStats.current_streak}
                            </Text>
                            <Text style={styles.miniStatLabel}>Seri</Text>
                        </View>
                        <View style={styles.miniStatDivider} />
                        <View style={styles.miniStat}>
                            <View
                                style={[
                                    styles.miniStatIcon,
                                    { backgroundColor: COLORS.accent + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="fitness"
                                    size={16}
                                    color={COLORS.accent}
                                />
                            </View>
                            <Text style={styles.miniStatValue}>
                                {summaryStats.total_workouts}
                            </Text>
                            <Text style={styles.miniStatLabel}>Koşu</Text>
                        </View>
                        <View style={styles.miniStatDivider} />
                        <View style={styles.miniStat}>
                            <View
                                style={[
                                    styles.miniStatIcon,
                                    { backgroundColor: COLORS.info + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="time"
                                    size={16}
                                    color={COLORS.info}
                                />
                            </View>
                            <Text style={styles.miniStatValue}>
                                {formatTime(summaryStats.total_duration_mins)}
                            </Text>
                            <Text style={styles.miniStatLabel}>Süre</Text>
                        </View>
                        <View style={styles.miniStatDivider} />
                        <View style={styles.miniStat}>
                            <View
                                style={[
                                    styles.miniStatIcon,
                                    { backgroundColor: COLORS.warning + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="trophy"
                                    size={16}
                                    color={COLORS.warning}
                                />
                            </View>
                            <Text style={styles.miniStatValue}>
                                {user?.longest_streak || 0}
                            </Text>
                            <Text style={styles.miniStatLabel}>Max Seri</Text>
                        </View>
                    </View>
                </View>

                {/* PROGRAM PROGRESS */}
                {activeProgram?.has_active_program && (() => {
                    const total =
                        activeProgram.total_workouts_count ||
                        activeProgram.total_workouts ||
                        0;
                    const completed =
                        activeProgram.completed_workouts ||
                        activeProgram.completed_workouts_count ||
                        0;
                    const remaining =
                        activeProgram.remaining_workouts !== undefined
                            ? activeProgram.remaining_workouts
                            : Math.max(0, total - completed);

                    return (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Aktif Program</Text>
                            <View style={styles.programCard}>
                                <View style={styles.programHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.programTitle}>
                                            {activeProgram.title}
                                        </Text>
                                        <Text style={styles.programWeek}>
                                            Hafta {activeProgram.current_week} /{" "}
                                            {activeProgram.total_weeks}
                                        </Text>
                                    </View>
                                    <View style={styles.percentBadge}>
                                        <Text style={styles.percentText}>
                                            %{progPercent}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.progressBarBg}>
                                    <LinearGradient
                                        colors={[COLORS.accent, COLORS.secondary]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[
                                            styles.progressBarFill,
                                            {
                                                width: `${Math.min(progPercent, 100)}%`,
                                            },
                                        ]}
                                    />
                                </View>

                                <View style={styles.programFooter}>
                                    <View style={styles.programFooterItem}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={14}
                                            color={COLORS.success}
                                        />
                                        <Text style={styles.footerText}>
                                            {completed} Tamamlandı
                                        </Text>
                                    </View>
                                    <View style={styles.programFooterItem}>
                                        <Ionicons
                                            name="hourglass-outline"
                                            size={14}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.footerText}>
                                            {remaining} Kaldı
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                })()}

                {/* CHARTS WITH TABS */}
                <View style={styles.sectionContainer}>
                    <View style={styles.chartTabRow}>
                        <Pressable
                            onPress={() => setActiveChart("distance")}
                            style={[
                                styles.chartTab,
                                activeChart === "distance" && styles.chartTabActive,
                            ]}
                        >
                            <Ionicons
                                name="trending-up"
                                size={16}
                                color={
                                    activeChart === "distance"
                                        ? COLORS.accent
                                        : COLORS.textDim
                                }
                            />
                            <Text
                                style={[
                                    styles.chartTabText,
                                    activeChart === "distance" &&
                                        styles.chartTabTextActive,
                                ]}
                            >
                                Mesafe
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveChart("pace")}
                            style={[
                                styles.chartTab,
                                activeChart === "pace" && styles.chartTabActive,
                            ]}
                        >
                            <Ionicons
                                name="speedometer"
                                size={16}
                                color={
                                    activeChart === "pace"
                                        ? COLORS.success
                                        : COLORS.textDim
                                }
                            />
                            <Text
                                style={[
                                    styles.chartTabText,
                                    activeChart === "pace" &&
                                        styles.chartTabTextActive,
                                ]}
                            >
                                Tempo
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.chartCard}>
                        <Text style={styles.chartLabel}>
                            {activeChart === "distance"
                                ? "Bu Hafta — Mesafe (km)"
                                : "Bu Hafta — Tempo (dk/km)"}
                        </Text>
                        {activeChart === "distance" ? (
                            <BarChart
                                data={{
                                    labels: WEEK_LABELS,
                                    datasets: [{ data: weeklyDistance.every(v => v === 0) ? [0, 0, 0, 0, 0, 0, 0.01] : weeklyDistance }],
                                }}
                                width={width - 72}
                                height={210}
                                yAxisSuffix=""
                                yAxisLabel=""
                                chartConfig={distanceBarChartConfig}
                                withInnerLines={true}
                                showValuesOnTopOfBars={false}
                                fromZero
                                style={styles.chartStyle}
                            />
                        ) : (
                            <BarChart
                                data={{
                                    labels: WEEK_LABELS,
                                    datasets: [{ data: weeklyPace.every(v => v === 0) ? [0, 0, 0, 0, 0, 0, 0.01] : weeklyPace }],
                                }}
                                width={width - 72}
                                height={210}
                                yAxisSuffix=""
                                yAxisLabel=""
                                chartConfig={paceBarChartConfig}
                                withInnerLines={true}
                                showValuesOnTopOfBars={false}
                                fromZero
                                style={styles.chartStyle}
                            />
                        )}
                    </View>
                </View>

                {/* DETAILED STATS */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Detaylı İstatistikler</Text>
                    <View style={styles.detailStatsCard}>
                        <View style={styles.detailStatRow}>
                            <View style={styles.detailStatLeft}>
                                <Ionicons
                                    name="speedometer-outline"
                                    size={20}
                                    color={COLORS.success}
                                />
                                <Text style={styles.detailStatLabel}>
                                    Güncel Tempo
                                </Text>
                            </View>
                            <Text style={styles.detailStatValue}>
                                {formatPace(user?.current_pace)}{" "}
                                <Text style={styles.detailStatUnit}>/km</Text>
                            </Text>
                        </View>
                        <View style={styles.detailStatSeparator} />
                        <View style={styles.detailStatRow}>
                            <View style={styles.detailStatLeft}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color={COLORS.info}
                                />
                                <Text style={styles.detailStatLabel}>
                                    Aktif Gün
                                </Text>
                            </View>
                            <Text style={styles.detailStatValue}>
                                {summaryStats.days_active}{" "}
                                <Text style={styles.detailStatUnit}>gün</Text>
                            </Text>
                        </View>
                        <View style={styles.detailStatSeparator} />
                        <View style={styles.detailStatRow}>
                            <View style={styles.detailStatLeft}>
                                <Ionicons
                                    name="walk-outline"
                                    size={20}
                                    color={COLORS.accent}
                                />
                                <Text style={styles.detailStatLabel}>
                                    Bu Hafta
                                </Text>
                            </View>
                            <Text style={styles.detailStatValue}>
                                {summaryStats.weekly_progress || 0}{" "}
                                <Text style={styles.detailStatUnit}>antrenman</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ACHIEVEMENTS */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Rozetler</Text>
                    {recentAchievements.length > 0 ? (
                        recentAchievements.map((ach, index) => (
                            <View key={index} style={styles.achievementCard}>
                                <LinearGradient
                                    colors={[
                                        (ach.icon_color || COLORS.warning) + "15",
                                        "transparent",
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.achievementGradient}
                                >
                                    <View
                                        style={[
                                            styles.achIconBox,
                                            {
                                                backgroundColor:
                                                    (ach.icon_color ||
                                                        COLORS.warning) + "20",
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name={ach.icon_name || "trophy"}
                                            size={22}
                                            color={
                                                ach.icon_color || COLORS.warning
                                            }
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.achTitle}>
                                            {ach.title}
                                        </Text>
                                        <Text style={styles.achDesc}>
                                            {ach.description}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyStateCard}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={28}
                                color={COLORS.inactive}
                            />
                            <Text style={styles.emptyStateText}>
                                Henüz kazanılmış rozet yok.
                            </Text>
                            <Text style={styles.emptyStateSubText}>
                                Koşmaya devam et, rozetler seni bekliyor!
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

export default ProgressScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 20 },

    // HERO HEADER
    heroHeader: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    heroStatRow: {
        marginTop: 24,
        alignItems: "center",
    },
    heroStatMain: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    heroStatValue: {
        color: COLORS.text,
        fontSize: 56,
        fontWeight: "900",
        letterSpacing: -2,
    },
    heroStatUnit: {
        color: COLORS.accent,
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 10,
        marginLeft: 4,
    },
    heroStatLabel: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginTop: 4,
    },

    // MINI STATS
    miniStatsRow: {
        flexDirection: "row",
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        alignItems: "center",
    },
    miniStat: {
        flex: 1,
        alignItems: "center",
    },
    miniStatIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    miniStatValue: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "800",
    },
    miniStatLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: "600",
        marginTop: 2,
    },
    miniStatDivider: {
        width: 1,
        height: 36,
        backgroundColor: COLORS.cardBorder,
    },

    // SECTION
    sectionContainer: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 12,
    },

    // PROGRAM
    programCard: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.card,
    },
    programHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    programTitle: { color: COLORS.text, fontSize: 17, fontWeight: "bold" },
    programWeek: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
    percentBadge: {
        backgroundColor: COLORS.accent + "15",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.accent + "30",
    },
    percentText: { color: COLORS.accent, fontWeight: "800", fontSize: 13 },
    progressBarBg: {
        height: 6,
        backgroundColor: COLORS.background,
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 16,
    },
    progressBarFill: { height: "100%", borderRadius: 3 },
    programFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    programFooterItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    footerText: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },

    // CHART TABS
    chartTabRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
    },
    chartTab: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    chartTabActive: {
        borderColor: COLORS.accent + "50",
        backgroundColor: COLORS.accent + "10",
    },
    chartTabText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
    },
    chartTabTextActive: {
        color: COLORS.text,
    },

    // CHART
    chartCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        paddingTop: 18,
        paddingBottom: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: "hidden",
        alignItems: "center",
    },
    chartLabel: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        alignSelf: "flex-start",
        marginLeft: 6,
    },
    chartStyle: {
        borderRadius: 16,
    },

    // DETAIL STATS
    detailStatsCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    detailStatRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    detailStatLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    detailStatLabel: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "500",
    },
    detailStatValue: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "800",
    },
    detailStatUnit: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "500",
    },
    detailStatSeparator: {
        height: 1,
        backgroundColor: COLORS.cardBorder,
        marginHorizontal: 16,
    },

    // ACHIEVEMENTS
    achievementCard: {
        borderRadius: 16,
        marginBottom: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.card,
    },
    achievementGradient: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
    },
    achIconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    achTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
    achDesc: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },

    // EMPTY STATE
    emptyStateCard: {
        padding: 24,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: "dashed",
    },
    emptyStateText: {
        color: COLORS.textDim,
        marginTop: 10,
        fontSize: 14,
        fontWeight: "600",
    },
    emptyStateSubText: {
        color: COLORS.inactive,
        marginTop: 4,
        fontSize: 12,
    },
});
