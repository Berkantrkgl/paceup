import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

// Hex → rgba helper (chart-kit opacity callback'leri için)
const hexToRgba = (hex: string, opacity: number): string => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const ProgressScreen = () => {
    const { user, getValidToken, refreshUserData } = useContext(AuthContext);
    const { colors, isDark } = useTheme();
    const styles = useThemedStyles(makeStyles);
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

    // Chart config'leri theme'e bağlı — tema değişiminde re-compute.
    const distanceBarChartConfig = useMemo(
        () => ({
            backgroundColor: "transparent",
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 1,
            color: (opacity = 1) => hexToRgba(colors.accent, opacity),
            labelColor: () => colors.text.secondary,
            barPercentage: 0.5,
            propsForBackgroundLines: {
                strokeDasharray: "",
                stroke: colors.border,
                strokeOpacity: 0.3,
            },
            fillShadowGradient: colors.accent,
            fillShadowGradientOpacity: 1,
        }),
        [colors],
    );

    const paceBarChartConfig = useMemo(
        () => ({
            backgroundColor: "transparent",
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 1,
            color: (opacity = 1) => hexToRgba(colors.success, opacity),
            labelColor: () => colors.text.secondary,
            barPercentage: 0.5,
            propsForBackgroundLines: {
                strokeDasharray: "",
                stroke: colors.border,
                strokeOpacity: 0.3,
            },
            fillShadowGradient: colors.success,
            fillShadowGradientOpacity: 1,
        }),
        [colors],
    );

    if (loading && !refreshing) {
        return (
            <View
                style={[
                    styles.container,
                    { justifyContent: "center", alignItems: "center" },
                ]}
            >
                <ActivityIndicator size="large" color={colors.accent} />
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
                        tintColor={colors.accent}
                        colors={[colors.accent]}
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
                                    { backgroundColor: colors.secondary + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="flame"
                                    size={16}
                                    color={colors.secondary}
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
                                    { backgroundColor: colors.accent + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="fitness"
                                    size={16}
                                    color={colors.accent}
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
                                    { backgroundColor: colors.info + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="time"
                                    size={16}
                                    color={colors.info}
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
                                    { backgroundColor: colors.warning + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="trophy"
                                    size={16}
                                    color={colors.warning}
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
                                        colors={[colors.accent, colors.secondary]}
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
                                            color={colors.success}
                                        />
                                        <Text style={styles.footerText}>
                                            {completed} Tamamlandı
                                        </Text>
                                    </View>
                                    <View style={styles.programFooterItem}>
                                        <Ionicons
                                            name="hourglass-outline"
                                            size={14}
                                            color={colors.text.secondary}
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
                                        ? colors.accent
                                        : colors.text.secondary
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
                                        ? colors.success
                                        : colors.text.secondary
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
                                    datasets: weeklyDistance.every(v => v === 0)
                                        ? [{ data: [0, 0, 0, 0, 0, 0, 0] }, { data: [6], withDots: false }]
                                        : [{ data: weeklyDistance }],
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
                                    datasets: weeklyPace.every(v => v === 0)
                                        ? [{ data: [0, 0, 0, 0, 0, 0, 0] }, { data: [8], withDots: false }]
                                        : [{ data: weeklyPace }],
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
                                    color={colors.success}
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
                                    color={colors.info}
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
                                    color={colors.accent}
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
                        recentAchievements.map((ach, index) => {
                            const achColor =
                                ach.icon_color || colors.warning;
                            return (
                            <View key={index} style={styles.achievementCard}>
                                <LinearGradient
                                    colors={
                                        isDark
                                            ? [achColor + "15", "transparent"]
                                            : [achColor, achColor + "A0"]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.achievementGradient}
                                >
                                    <View
                                        style={[
                                            styles.achIconBox,
                                            {
                                                backgroundColor: isDark
                                                    ? achColor + "20"
                                                    : "rgba(255,255,255,0.25)",
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name={ach.icon_name || "trophy"}
                                            size={22}
                                            color={
                                                isDark ? achColor : colors.white
                                            }
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={[
                                                styles.achTitle,
                                                !isDark && {
                                                    color: colors.white,
                                                },
                                            ]}
                                        >
                                            {ach.title}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.achDesc,
                                                !isDark && {
                                                    color: "rgba(255,255,255,0.85)",
                                                },
                                            ]}
                                        >
                                            {ach.description}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyStateCard}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={28}
                                color={colors.inactive}
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

const makeStyles = (t: Theme) => {
    const c = t.colors;
    return {
        container: { flex: 1, backgroundColor: c.background },
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
            alignItems: "center" as const,
        },
        heroStatMain: {
            flexDirection: "row" as const,
            alignItems: "flex-end" as const,
        },
        heroStatValue: {
            color: c.text.primary,
            fontSize: 56,
            fontWeight: "900" as const,
            letterSpacing: -2,
        },
        heroStatUnit: {
            color: c.accent,
            fontSize: 22,
            fontWeight: "700" as const,
            marginBottom: 10,
            marginLeft: 4,
        },
        heroStatLabel: {
            color: c.text.secondary,
            fontSize: 13,
            fontWeight: "600" as const,
            textTransform: "uppercase" as const,
            letterSpacing: 1.5,
            marginTop: 4,
        },

        // MINI STATS
        miniStatsRow: {
            flexDirection: "row" as const,
            backgroundColor: c.surface,
            borderRadius: 16,
            padding: 16,
            marginTop: 20,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center" as const,
        },
        miniStat: {
            flex: 1,
            alignItems: "center" as const,
        },
        miniStatIcon: {
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: "center" as const,
            justifyContent: "center" as const,
            marginBottom: 6,
        },
        miniStatValue: {
            color: c.text.primary,
            fontSize: 15,
            fontWeight: "800" as const,
        },
        miniStatLabel: {
            color: c.text.secondary,
            fontSize: 10,
            fontWeight: "600" as const,
            marginTop: 2,
        },
        miniStatDivider: {
            width: 1,
            height: 36,
            backgroundColor: c.border,
        },

        // SECTION
        sectionContainer: {
            marginTop: 24,
            paddingHorizontal: 20,
        },
        sectionTitle: {
            color: c.text.primary,
            fontSize: 18,
            fontWeight: "700" as const,
            marginBottom: 12,
        },

        // PROGRAM
        programCard: {
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
        },
        programHeader: {
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            alignItems: "flex-start" as const,
            marginBottom: 16,
        },
        programTitle: {
            color: c.text.primary,
            fontSize: 17,
            fontWeight: "bold" as const,
        },
        programWeek: { color: c.text.secondary, fontSize: 13, marginTop: 2 },
        percentBadge: {
            backgroundColor: c.accent + "15",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.accent + "30",
        },
        percentText: {
            color: c.accent,
            fontWeight: "800" as const,
            fontSize: 13,
        },
        progressBarBg: {
            height: 6,
            backgroundColor: c.surfaceVariant,
            borderRadius: 3,
            overflow: "hidden" as const,
            marginBottom: 16,
        },
        progressBarFill: { height: "100%" as const, borderRadius: 3 },
        programFooter: {
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
        },
        programFooterItem: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            gap: 5,
        },
        footerText: {
            color: c.text.secondary,
            fontSize: 12,
            fontWeight: "600" as const,
        },

        // CHART TABS
        chartTabRow: {
            flexDirection: "row" as const,
            gap: 8,
            marginBottom: 12,
        },
        chartTab: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
        },
        chartTabActive: {
            borderColor: c.accent + "50",
            backgroundColor: c.accent + "10",
        },
        chartTabText: {
            color: c.text.secondary,
            fontSize: 13,
            fontWeight: "600" as const,
        },
        chartTabTextActive: {
            color: c.text.primary,
        },

        // CHART
        chartCard: {
            backgroundColor: c.surface,
            borderRadius: 20,
            paddingTop: 18,
            paddingBottom: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: c.border,
            overflow: "hidden" as const,
            alignItems: "center" as const,
        },
        chartLabel: {
            color: c.text.secondary,
            fontSize: 12,
            fontWeight: "600" as const,
            marginBottom: 12,
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
            alignSelf: "flex-start" as const,
            marginLeft: 6,
        },
        chartStyle: {
            borderRadius: 16,
        },

        // DETAIL STATS
        detailStatsCard: {
            backgroundColor: c.surface,
            borderRadius: 20,
            padding: 4,
            borderWidth: 1,
            borderColor: c.border,
        },
        detailStatRow: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            justifyContent: "space-between" as const,
            paddingVertical: 14,
            paddingHorizontal: 16,
        },
        detailStatLeft: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            gap: 10,
        },
        detailStatLabel: {
            color: c.text.primary,
            fontSize: 14,
            fontWeight: "500" as const,
        },
        detailStatValue: {
            color: c.text.primary,
            fontSize: 16,
            fontWeight: "800" as const,
        },
        detailStatUnit: {
            color: c.text.secondary,
            fontSize: 12,
            fontWeight: "500" as const,
        },
        detailStatSeparator: {
            height: 1,
            backgroundColor: c.border,
            marginHorizontal: 16,
        },

        // ACHIEVEMENTS
        achievementCard: {
            borderRadius: 16,
            marginBottom: 8,
            overflow: "hidden" as const,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
        },
        achievementGradient: {
            flexDirection: "row" as const,
            alignItems: "center" as const,
            padding: 14,
            gap: 12,
        },
        achIconBox: {
            width: 42,
            height: 42,
            borderRadius: 14,
            justifyContent: "center" as const,
            alignItems: "center" as const,
        },
        achTitle: {
            color: c.text.primary,
            fontSize: 14,
            fontWeight: "700" as const,
        },
        achDesc: { color: c.text.secondary, fontSize: 12, marginTop: 2 },

        // EMPTY STATE
        emptyStateCard: {
            padding: 24,
            backgroundColor: c.surface,
            borderRadius: 16,
            alignItems: "center" as const,
            borderWidth: 1,
            borderColor: c.border,
            borderStyle: "dashed" as const,
        },
        emptyStateText: {
            color: c.text.secondary,
            marginTop: 10,
            fontSize: 14,
            fontWeight: "600" as const,
        },
        emptyStateSubText: {
            color: c.inactive,
            marginTop: 4,
            fontSize: 12,
        },
    } as const;
};
