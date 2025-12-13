import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    ImageBackground,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

// API URL (AuthContext ile aynı olmalı - iOS Simülatör için)
const API_URL = "http://127.0.0.1:8000/api";

// Workout Tipi (Basitleştirilmiş)
type Workout = {
    id: string;
    title: string;
    scheduled_date: string;
    scheduled_time: string;
    workout_type: string;
};

const HomeScreen = () => {
    // 1. Context'ten verileri al
    const { user, token, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);

    // Yaklaşan antrenman state'i
    const [nextWorkout, setNextWorkout] = useState<Workout | null>(null);

    // --- YENİ EKLENEN FONKSİYON: Antrenmanları Çek ve En Yakını Bul ---
    const fetchNextWorkout = async () => {
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/workouts/`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                const workouts: Workout[] = await response.json();

                // 1. Tarihi geçmiş olanları ele (Bugün ve sonrası kalsın)
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Saati sıfırla ki bugünün antrenmanlarını da alalım

                const upcomingWorkouts = workouts.filter((w) => {
                    const wDate = new Date(w.scheduled_date);
                    return wDate >= today;
                });

                // 2. Tarihe göre sırala (En yakın en üstte)
                upcomingWorkouts.sort((a, b) => {
                    const dateA = new Date(
                        `${a.scheduled_date}T${a.scheduled_time || "00:00"}`
                    );
                    const dateB = new Date(
                        `${b.scheduled_date}T${b.scheduled_time || "00:00"}`
                    );
                    return dateA.getTime() - dateB.getTime();
                });

                // 3. İlk sıradakini (en yakını) state'e at
                if (upcomingWorkouts.length > 0) {
                    setNextWorkout(upcomingWorkouts[0]);
                } else {
                    setNextWorkout(null);
                }
            }
        } catch (error) {
            console.log("Workout fetch error:", error);
        }
    };

    // Sayfa ilk açıldığında çalıştır
    useEffect(() => {
        fetchNextWorkout();
    }, [token]);

    // Pull-to-refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUserData(); // User istatistiklerini güncelle
        await fetchNextWorkout(); // Yaklaşan antrenmanı güncelle
        setRefreshing(false);
    }, []);

    // --- HELPER: Tarih Formatlama (örn: 14 EKM) ---
    const formatWorkoutDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        // Ay ismini Türkçe kısaltma olarak al (Oca, Şub...)
        const month = date
            .toLocaleDateString("tr-TR", { month: "short" })
            .toUpperCase();
        return { day, month };
    };

    // --- HELPER: Saat Formatlama (örn: 07:00) ---
    const formatWorkoutTime = (timeString: string) => {
        if (!timeString) return "Belirtilmedi";
        // '07:00:00' -> '07:00'
        return timeString.slice(0, 5);
    };

    // --- DİNAMİK MANTIKLAR (Eski Kodlar) ---
    const formattedName = user?.username
        ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
        : "Koşucu";
    const hasExistingPlan = (user?.total_workouts || 0) > 0;
    const totalWorkouts = user?.total_workouts || 0;
    const totalDistance = user?.total_distance?.toFixed(1) || "0.0";
    const streak = user?.current_streak || 0;

    const getDisplayName = () => {
        if (user?.first_name) {
            return (
                user.first_name.charAt(0).toUpperCase() +
                user.first_name.slice(1)
            );
        }
        if (user?.username) {
            return (
                user.username.charAt(0).toUpperCase() + user.username.slice(1)
            );
        }
        return "Koşucu";
    };

    const displayName = getDisplayName();

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="light-content" />

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
                    />
                }
            >
                {/* HEADER SECTION */}
                <View style={styles.headerContainer}>
                    <ImageBackground
                        source={require("../../../../../assets/images/home/banner-image.jpeg")}
                        style={styles.headerImage}
                        imageStyle={{ borderRadius: 30 }}
                    >
                        <View style={styles.fullImageOverlay}>
                            <View style={styles.textContainer}>
                                <Text style={styles.headerTitle}>
                                    Hoş Geldin, {displayName}!
                                </Text>
                                <Text style={styles.headerSubtitle}>
                                    Bugün hedeflerini parçalamaya hazır mısın?
                                </Text>
                            </View>
                        </View>
                    </ImageBackground>
                </View>

                {/* ANA AKSİYON */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {hasExistingPlan ? "Genel Durum" : "Antrenman Planı"}
                    </Text>

                    {!hasExistingPlan ? (
                        /* Plan Yoksa - Chatbot Kartı */
                        <View style={styles.chatbotCardSpecial}>
                            <View style={styles.cardIconContainer}>
                                <View style={styles.iconGradientCircle}>
                                    <Ionicons
                                        name="flash"
                                        size={36}
                                        color="white"
                                    />
                                </View>
                            </View>
                            <Text style={styles.cardTitleSpecial}>
                                Yapay Zeka Koçun Seni Bekliyor!
                            </Text>
                            <Text style={styles.cardDescriptionSpecial}>
                                Henüz bir antrenman kaydın yok. Sana özel koşu
                                programını oluşturmak için sadece birkaç soru!
                            </Text>
                            <Link href={"/chatbot"} asChild>
                                <Pressable style={styles.primaryButtonSpecial}>
                                    <View style={styles.buttonContent}>
                                        <Ionicons
                                            name="chatbubbles"
                                            size={22}
                                            color="white"
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text
                                            style={
                                                styles.primaryButtonTextSpecial
                                            }
                                        >
                                            İlk Planımı Oluştur
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="arrow-forward"
                                        size={22}
                                        color="white"
                                    />
                                </Pressable>
                            </Link>
                            {/* Features List... */}
                        </View>
                    ) : (
                        /* Plan Varsa - İstatistikler */
                        <View style={styles.progressContainer}>
                            {/* Sol Kart */}
                            <Link href={"/progress"} asChild push>
                                <Pressable style={styles.progressCard}>
                                    <View style={styles.progressHeader}>
                                        <Ionicons
                                            name="fitness"
                                            size={24}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.progressLabel}>
                                            Antrenmanlar
                                        </Text>
                                    </View>
                                    <View style={styles.circularProgress}>
                                        <View style={styles.progressCircle}>
                                            <Text style={styles.percentageText}>
                                                {totalWorkouts}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.progressDetail}>
                                        Toplam Tamamlanan
                                    </Text>
                                </Pressable>
                            </Link>
                            {/* Sağ Kart */}
                            <Link href={"/progress"} asChild push>
                                <Pressable style={styles.progressCard}>
                                    <View style={styles.statsContainer}>
                                        <View style={styles.statItem}>
                                            <Ionicons
                                                name="map"
                                                size={28}
                                                color={COLORS.accent}
                                            />
                                            <View
                                                style={styles.statTextContainer}
                                            >
                                                <Text style={styles.statValue}>
                                                    {totalDistance} km
                                                </Text>
                                                <Text style={styles.statLabel}>
                                                    Toplam Mesafe
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.divider} />
                                        <View style={styles.statItem}>
                                            <Ionicons
                                                name="flame"
                                                size={28}
                                                color="#FFA500"
                                            />
                                            <View
                                                style={styles.statTextContainer}
                                            >
                                                <Text style={styles.statValue}>
                                                    {streak} gün
                                                </Text>
                                                <Text style={styles.statLabel}>
                                                    Aktif Seri
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </Pressable>
                            </Link>
                        </View>
                    )}
                </View>

                {/* --- GÜNCELLENEN KISIM: YAKLAŞAN ANTREMAN --- */}
                <Link href={"/calendar_modal"} asChild push>
                    <Pressable style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Yaklaşan Antrenman
                        </Text>

                        {/* Antrenman Varsa */}
                        {nextWorkout ? (
                            <View
                                style={[
                                    styles.infoCard,
                                    {
                                        flexDirection: "row",
                                        alignItems: "center",
                                    },
                                ]}
                            >
                                <View style={styles.dateBox}>
                                    <Text style={styles.dateText}>
                                        {
                                            formatWorkoutDate(
                                                nextWorkout.scheduled_date
                                            ).day
                                        }
                                    </Text>
                                    <Text style={styles.monthText}>
                                        {
                                            formatWorkoutDate(
                                                nextWorkout.scheduled_date
                                            ).month
                                        }
                                    </Text>
                                </View>
                                <View style={{ marginLeft: 15, flex: 1 }}>
                                    <Text style={styles.workoutTitle}>
                                        {nextWorkout.title}
                                    </Text>
                                    <Text style={styles.workoutTime}>
                                        {formatWorkoutTime(
                                            nextWorkout.scheduled_time
                                        )}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={24}
                                    color={COLORS.text}
                                />
                            </View>
                        ) : (
                            /* Antrenman Yoksa - Empty State */
                            <View
                                style={[
                                    styles.infoCard,
                                    {
                                        alignItems: "center",
                                        paddingVertical: 25,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="calendar-outline"
                                    size={32}
                                    color={COLORS.subText}
                                    style={{ marginBottom: 8 }}
                                />
                                <Text
                                    style={{
                                        color: COLORS.subText,
                                        fontSize: 16,
                                    }}
                                >
                                    Yaklaşan antrenman bulunamadı.
                                </Text>
                                <Text
                                    style={{
                                        color: COLORS.subText,
                                        fontSize: 12,
                                        marginTop: 4,
                                    }}
                                >
                                    Takvimden yeni bir antrenman ekleyebilirsin.
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </Link>

                {/* GRID BUTONLAR */}
                <View style={[styles.gridContainer, { marginTop: 10 }]}>
                    <Link href={"/progress"} asChild push>
                        <Pressable style={styles.secondaryButton}>
                            <Ionicons
                                name="stats-chart"
                                size={32}
                                color="white"
                            />
                            <Text style={styles.secondaryButtonText}>
                                İLERLEMEM
                            </Text>
                        </Pressable>
                    </Link>

                    <Link href={"/plans"} asChild push>
                        <Pressable style={styles.secondaryButton}>
                            <Ionicons name="list" size={32} color="white" />
                            <Text style={styles.secondaryButtonText}>
                                PLANLARIM
                            </Text>
                        </Pressable>
                    </Link>
                </View>

                {/* Alt boşluk */}
                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

export default HomeScreen;

// Styles aynı kalacak
const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    // HEADER STYLES
    headerContainer: {
        height: 300,
        width: "100%",
        marginBottom: 20,
    },
    headerImage: {
        flex: 1,
    },
    fullImageOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
        borderRadius: 30,
    },
    textContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    headerTitle: {
        color: "white",
        fontSize: 40,
        fontWeight: "bold",
    },
    headerSubtitle: {
        color: COLORS.text,
        fontSize: 20,
        marginTop: 5,
        opacity: 0.9,
    },
    // SECTION STYLES
    section: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "600",
        marginBottom: 14,
    },
    // SPECIAL CHATBOT CARD (Plan Yoksa)
    chatbotCardSpecial: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 25,
        borderWidth: 2,
        borderColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    cardIconContainer: {
        alignItems: "center",
        marginBottom: 15,
    },
    iconGradientCircle: {
        backgroundColor: COLORS.accent,
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
    },
    cardTitleSpecial: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
        textAlign: "center",
    },
    cardDescriptionSpecial: {
        color: "#B0B0B0",
        fontSize: 15,
        marginBottom: 20,
        lineHeight: 22,
        textAlign: "center",
    },
    primaryButtonSpecial: {
        backgroundColor: COLORS.accent,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    buttonContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    primaryButtonTextSpecial: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    featuresList: {
        gap: 8,
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    featureText: {
        color: "#B0B0B0",
        fontSize: 14,
    },
    // PROGRESS CARDS (Plan Varsa)
    progressContainer: {
        flexDirection: "row",
        gap: 15,
    },
    progressCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    progressHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 15,
    },
    progressLabel: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
    },
    circularProgress: {
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 10,
    },
    progressCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.background,
        borderWidth: 6,
        borderColor: COLORS.accent,
        justifyContent: "center",
        alignItems: "center",
    },
    percentageText: {
        color: COLORS.accent,
        fontSize: 22,
        fontWeight: "bold",
    },
    progressDetail: {
        color: "#B0B0B0",
        fontSize: 13,
        textAlign: "center",
        marginTop: 5,
    },
    statsContainer: {
        flex: 1,
        justifyContent: "space-between",
    },
    statItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    statTextContainer: {
        flex: 1,
    },
    statValue: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "bold",
    },
    statLabel: {
        color: "#B0B0B0",
        fontSize: 12,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(176, 176, 176, 0.2)",
        marginVertical: 12,
    },
    // INFO CARD STYLES
    infoCard: {
        backgroundColor: COLORS.card,
        padding: 15,
        borderRadius: 12,
    },
    dateBox: {
        backgroundColor: COLORS.background,
        padding: 10,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        width: 50,
    },
    dateText: {
        color: COLORS.accent,
        fontSize: 18,
        fontWeight: "bold",
    },
    monthText: {
        color: COLORS.text,
        fontSize: 10,
        fontWeight: "bold",
    },
    workoutTitle: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
    workoutTime: {
        color: "#B0B0B0",
        fontSize: 13,
        marginTop: 2,
    },
    // GRID BUTTONS
    gridContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        gap: 15,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: COLORS.accent,
        padding: 20,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        height: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        elevation: 6,
    },
    secondaryButtonText: {
        color: "white",
        marginTop: 8,
        fontSize: 16,
        fontWeight: "bold",
    },
});
