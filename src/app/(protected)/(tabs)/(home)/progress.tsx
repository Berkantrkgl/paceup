import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient"; // Gradient eklendi
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config"; // Config'den çekiyoruz
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

const ProgressScreen = () => {
    const { user, token, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Initial Data
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
            // Paralel fetch yapalım, daha hızlı olsun
            const [summaryRes, chartRes, progRes, achRes] = await Promise.all([
                fetch(`${API_URL}/stats/summary/`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/stats/charts/?period=week`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/stats/program/`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/achievements/`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            // 1. SUMMARY
            if (summaryRes.ok) {
                const data = await summaryRes.json();
                setSummaryStats(data);
            }

            // 2. CHARTS
            if (chartRes.ok) {
                const data = await chartRes.json();
                if (data.datasets && data.datasets[0].data.length > 0) {
                    setChartData(data.datasets[0].data);
                    setChartLabels(data.labels);
                    setPaceHistory(data.pace_data || [0]);
                }
            }

            // 3. PROGRAM
            if (progRes.ok) {
                const data = await progRes.json();
                setActiveProgram(data);
            }

            // 4. ACHIEVEMENTS
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
    }, [token]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUserData();
        await fetchStatsData();
        setRefreshing(false);
    }, []);

    // --- CHART CONFIG (DARK THEME) ---
    const chartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: "transparent",
        backgroundGradientTo: "transparent",
        decimalPlaces: 1, // Virgülden sonra tek hane
        color: (opacity = 1) => COLORS.accent, // Çizgi rengi
        labelColor: (opacity = 1) => COLORS.textDim, // Yazı rengi
        style: { borderRadius: 16 },
        propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: COLORS.card, // Nokta içi
            fill: COLORS.accent,
        },
        propsForBackgroundLines: {
            strokeDasharray: "", // Düz çizgi
            stroke: COLORS.cardBorder, // Izgara rengi silik
            strokeOpacity: 0.5,
        },
        fillShadowGradient: COLORS.accent,
        fillShadowGradientOpacity: 0.3,
    };

    // Zaman Formatlama
    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) return `${hours}sa ${mins}dk`;
        return `${mins}dk`;
    };

    const progPercent = activeProgram?.progress_percent || 0;

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
                {/* HEADER */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>İlerleme & Analiz</Text>
                    <Text style={styles.headerSubtitle}>
                        Performansını takip et
                    </Text>
                </View>

                {/* 1. HERO STATS (GRID) */}
                <View style={styles.statsGrid}>
                    {/* Toplam Mesafe (Büyük Kart) */}
                    <View style={[styles.statCard, styles.statCardLarge]}>
                        <View style={styles.statHeaderRow}>
                            <View
                                style={[
                                    styles.iconBox,
                                    { backgroundColor: COLORS.accent + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="map"
                                    size={20}
                                    color={COLORS.accent}
                                />
                            </View>
                            <Text style={styles.statLabel}>Toplam Mesafe</Text>
                        </View>
                        <Text style={styles.statValueLarge}>
                            {summaryStats.total_distance}{" "}
                            <Text style={styles.unitText}>km</Text>
                        </Text>
                    </View>

                    {/* Sağ Sütun */}
                    <View style={styles.statsColumn}>
                        {/* 1. KART: AKTİF SERİ (Current Streak) */}
                        <View style={styles.statCardSmall}>
                            <View
                                style={[
                                    styles.iconBoxSmall,
                                    {
                                        backgroundColor:
                                            COLORS.secondary + "20",
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="flame"
                                    size={20}
                                    color={COLORS.secondary}
                                />
                            </View>
                            <View>
                                {/* Veriyi user.current_streak'ten çekiyoruz */}
                                <Text style={styles.statValueSmall}>
                                    {summaryStats.current_streak} Gün
                                </Text>
                                <Text style={styles.statLabelSmall}>
                                    Aktif Seri
                                </Text>
                            </View>
                        </View>

                        {/* 2. KART: TOPLAM KOŞU (Total Workouts) */}
                        <View style={styles.statCardSmall}>
                            <View
                                style={[
                                    styles.iconBoxSmall,
                                    { backgroundColor: COLORS.warning + "20" },
                                ]}
                            >
                                <Ionicons
                                    name="fitness"
                                    size={20}
                                    color={COLORS.warning}
                                />
                            </View>
                            <View>
                                <Text style={styles.statValueSmall}>
                                    {summaryStats.total_workouts}
                                </Text>
                                <Text style={styles.statLabelSmall}>
                                    Toplam Koşu
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. PROGRAM PROGRESS (GRADIENT CARD) */}
                {activeProgram?.has_active_program && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Aktif Program</Text>

                        {/* --- GÜNCELLEME: HESAPLAMA MANTIĞI --- */}
                        {(() => {
                            // Backend farklı isimlendirmeler kullanabilir diye önlem alıyoruz
                            const total =
                                activeProgram.total_workouts_count ||
                                activeProgram.total_workouts ||
                                0;
                            const completed =
                                activeProgram.completed_workouts ||
                                activeProgram.completed_workouts_count ||
                                0;

                            // Eğer backend 'remaining' yollamazsa biz hesaplarız
                            const remaining =
                                activeProgram.remaining_workouts !== undefined
                                    ? activeProgram.remaining_workouts
                                    : Math.max(0, total - completed);

                            return (
                                <LinearGradient
                                    colors={[COLORS.card, COLORS.cardVariant]}
                                    style={styles.programCard}
                                >
                                    <View style={styles.programHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.programTitle}>
                                                {activeProgram.title}
                                            </Text>
                                            <Text style={styles.programWeek}>
                                                Hafta{" "}
                                                {activeProgram.current_week} /{" "}
                                                {activeProgram.total_weeks}
                                            </Text>
                                        </View>
                                        <View style={styles.percentBadge}>
                                            <Text style={styles.percentText}>
                                                %{progPercent}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Custom Progress Bar */}
                                    <View style={styles.progressBarBg}>
                                        <LinearGradient
                                            colors={[
                                                COLORS.accent,
                                                COLORS.secondary,
                                            ]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[
                                                styles.progressBarFill,
                                                { width: `${progPercent}%` },
                                            ]}
                                        />
                                    </View>

                                    <View style={styles.programFooter}>
                                        <Text style={styles.footerText}>
                                            <Ionicons
                                                name="checkmark-circle-outline"
                                                size={14}
                                            />{" "}
                                            {completed} Tamamlandı
                                        </Text>

                                        {/* BURASI DÜZELDİ: Hesaplanan 'remaining' değişkenini kullanıyoruz */}
                                        <Text style={styles.footerText}>
                                            <Ionicons
                                                name="hourglass-outline"
                                                size={14}
                                            />{" "}
                                            {remaining} Kaldı
                                        </Text>
                                    </View>
                                </LinearGradient>
                            );
                        })()}
                    </View>
                )}

                {/* 3. CHARTS */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>
                        Haftalık Mesafe (km)
                    </Text>
                    <View style={styles.chartCard}>
                        <LineChart
                            data={{
                                labels: chartLabels,
                                datasets: [{ data: chartData }],
                            }}
                            width={width - 40} // Ekran genişliği - padding
                            height={220}
                            chartConfig={chartConfig}
                            bezier
                            withDots={true}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLines={false}
                            style={{ marginVertical: 8, borderRadius: 16 }}
                        />
                    </View>
                </View>

                {/* 4. PACE CHART (Secondary Color) */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>
                        Tempo Analizi (dk/km)
                    </Text>
                    <View style={styles.chartCard}>
                        <LineChart
                            data={{
                                labels: chartLabels,
                                datasets: [{ data: paceHistory }],
                            }}
                            width={width - 40}
                            height={220}
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => COLORS.success, // Yeşil tonu
                                fillShadowGradient: COLORS.success,
                            }}
                            bezier
                            withVerticalLines={false}
                            style={{ marginVertical: 8, borderRadius: 16 }}
                        />
                    </View>
                </View>

                {/* 5. SECONDARY STATS ROW */}
                <View style={styles.statsRowTriple}>
                    <View style={styles.statCardTriple}>
                        <Ionicons
                            name="time-outline"
                            size={24}
                            color={COLORS.info}
                        />
                        <Text style={styles.statValueTriple}>
                            {formatTime(summaryStats.total_duration_mins)}
                        </Text>
                        <Text style={styles.statLabelTriple}>Toplam Süre</Text>
                    </View>
                    <View style={styles.statCardTriple}>
                        <Ionicons
                            name="flame-outline"
                            size={24}
                            color={COLORS.secondary}
                        />
                        <Text style={styles.statValueTriple}>
                            {summaryStats.calories_burned}
                        </Text>
                        <Text style={styles.statLabelTriple}>Kalori</Text>
                    </View>
                    <View style={styles.statCardTriple}>
                        <Ionicons
                            name="trophy-outline"
                            size={24}
                            color={COLORS.warning}
                        />
                        <Text style={styles.statValueTriple}>
                            {user?.longest_streak || 0}
                        </Text>
                        <Text style={styles.statLabelTriple}>Max Seri</Text>
                    </View>
                </View>

                {/* 6. ACHIEVEMENTS */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Son Rozetler</Text>
                    {recentAchievements.length > 0 ? (
                        recentAchievements.map((ach, index) => (
                            <View key={index} style={styles.achievementCard}>
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
                                        size={24}
                                        color={ach.icon_color || COLORS.warning}
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
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={COLORS.cardBorder}
                                />
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyStateCard}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={32}
                                color={COLORS.inactive}
                            />
                            <Text style={styles.emptyStateText}>
                                Henüz kazanılmış rozet yok.
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
    scrollContent: { padding: 20, paddingTop: 60 }, // Header için boşluk

    // HEADER
    header: { marginBottom: 24 },
    headerTitle: {
        color: COLORS.text,
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    headerSubtitle: { color: COLORS.textDim, fontSize: 16, marginTop: 4 },

    // SECTION COMMON
    sectionContainer: { marginBottom: 24 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 12,
        marginLeft: 4,
    },

    // STATS GRID (Hero)
    statsGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
    statsColumn: { flex: 1, gap: 12, justifyContent: "space-between" },

    statCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statCardLarge: { flex: 1.2, height: 150, justifyContent: "space-between" },
    statCardSmall: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },

    statHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    statLabel: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    statValueLarge: { color: COLORS.text, fontSize: 36, fontWeight: "900" },
    unitText: { color: COLORS.accent, fontSize: 18, fontWeight: "600" },

    statValueSmall: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
    statLabelSmall: { color: COLORS.textDim, fontSize: 12 },

    iconBoxSmall: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },

    // PROGRAM CARD
    programCard: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    programHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 15,
    },
    programTitle: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
    programWeek: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
    percentBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    percentText: { color: COLORS.accent, fontWeight: "bold", fontSize: 12 },

    progressBarBg: {
        height: 8,
        backgroundColor: COLORS.background,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 15,
    },
    progressBarFill: { height: "100%", borderRadius: 4 },

    programFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 5,
    },
    footerText: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },

    // CHARTS
    chartCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 10, // Chart padding
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: "hidden", // Taşmaları engelle
    },

    // TRIPLE STATS ROW
    statsRowTriple: { flexDirection: "row", gap: 10, marginBottom: 24 },
    statCardTriple: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 15,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statValueTriple: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 8,
    },
    statLabelTriple: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },

    // ACHIEVEMENTS
    achievementCard: {
        backgroundColor: COLORS.card,
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        gap: 15,
    },
    achIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
    },
    achTitle: { color: COLORS.text, fontSize: 15, fontWeight: "bold" },
    achDesc: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },

    emptyStateCard: {
        padding: 20,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: "dashed",
    },
    emptyStateText: { color: COLORS.textDim, marginTop: 8 },
});
