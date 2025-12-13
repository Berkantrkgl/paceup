import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import {
    ActivityIndicator,
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

// API URL
const API_URL = "http://127.0.0.1:8000/api";

// Workout Type
type Workout = {
    id: string;
    title: string;
    scheduled_date: string;
    scheduled_time: string;
    workout_type: string;
    planned_duration: number;
    status: string;
};

// Helper to get style based on type
const getWorkoutTypeStyle = (type: string) => {
    switch (type) {
        case "tempo":
            return {
                icon: "speedometer-outline",
                color: "#FF6B6B",
                name: "Tempo",
            };
        case "easy":
            return { icon: "walk-outline", color: "#4ECDC4", name: "Hafif" };
        case "interval":
            return {
                icon: "flash-outline",
                color: "#FFD93D",
                name: "İnterval",
            };
        case "long":
            return {
                icon: "trending-up-outline",
                color: "#A569BD",
                name: "Uzun",
            };
        case "rest":
            return { icon: "moon-outline", color: "#95A5A6", name: "Dinlenme" };
        default:
            return {
                icon: "fitness-outline",
                color: COLORS.accent,
                name: "Koşu",
            };
    }
};

const HomeScreen = () => {
    const { user, token, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);
    const [nextWorkout, setNextWorkout] = useState<Workout | null>(null);

    // Fetch Next Workout
    const fetchNextWorkout = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/workouts/`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const workouts: Workout[] = await response.json();
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const upcomingWorkouts = workouts.filter((w) => {
                    const wDate = new Date(w.scheduled_date);
                    return wDate >= today && w.status !== "completed";
                });

                upcomingWorkouts.sort((a, b) => {
                    const dateA = new Date(
                        `${a.scheduled_date}T${a.scheduled_time || "00:00"}`
                    );
                    const dateB = new Date(
                        `${b.scheduled_date}T${b.scheduled_time || "00:00"}`
                    );
                    return dateA.getTime() - dateB.getTime();
                });

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

    useFocusEffect(
        useCallback(() => {
            fetchNextWorkout();
        }, [token])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUserData();
        await fetchNextWorkout();
        setRefreshing(false);
    }, []);

    // Navigation Handler
    const handleNextWorkoutPress = () => {
        if (!nextWorkout) {
            // Antrenman yoksa bile takvimi açsın, boş halini görsün
            router.push("/calendar_modal");
            return;
        }

        router.push({
            pathname: "/calendar_modal", // ProtectedLayout içinde tanımlı isim
            params: { workoutId: nextWorkout.id },
        });
    };

    // Helpers
    const formatWorkoutDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date
            .toLocaleDateString("tr-TR", { month: "short" })
            .toUpperCase();
        return { day, month };
    };

    const formatWorkoutTime = (timeString: string) => {
        if (!timeString) return "Tüm Gün";
        return timeString.slice(0, 5);
    };

    // Dynamic Logic
    if (!user) {
        return (
            <View
                style={[
                    styles.mainContainer,
                    { justifyContent: "center", alignItems: "center" },
                ]}
            >
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    const formattedName = user.first_name
        ? user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1)
        : user.username;

    const hasExistingPlan = (user.total_workouts || 0) > 0;
    const totalWorkouts = user.total_workouts || 0;
    const totalDistance = user.total_distance?.toFixed(1) || "0.0";
    const streak = user.current_streak || 0;

    const workoutStyle = nextWorkout
        ? getWorkoutTypeStyle(nextWorkout.workout_type)
        : null;

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
                {/* HEADER */}
                <View style={styles.headerContainer}>
                    <ImageBackground
                        source={require("../../../../../assets/images/home/banner-image.jpeg")}
                        style={styles.headerImage}
                        imageStyle={{ borderRadius: 30 }}
                    >
                        <View style={styles.fullImageOverlay}>
                            <View style={styles.textContainer}>
                                <Text style={styles.headerTitle}>
                                    Hoş Geldin, {formattedName}!
                                </Text>
                                <Text style={styles.headerSubtitle}>
                                    Bugün hedeflerini parçalamaya hazır mısın?
                                </Text>
                            </View>
                        </View>
                    </ImageBackground>
                </View>

                {/* MAIN ACTION SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {hasExistingPlan ? "Genel Durum" : "Antrenman Planı"}
                    </Text>

                    {!hasExistingPlan ? (
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
                        </View>
                    ) : (
                        <View style={styles.progressContainer}>
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

                {/* UPCOMING WORKOUT SECTION */}
                <Pressable
                    style={styles.section}
                    onPress={handleNextWorkoutPress}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 15,
                        }}
                    >
                        <Text style={styles.sectionTitle}>
                            Yaklaşan Antrenman
                        </Text>
                        <Pressable
                            onPress={() =>
                                router.push("/(protected)/calendar_modal")
                            }
                        >
                            <Ionicons
                                name="calendar"
                                size={22}
                                color={COLORS.accent}
                            />
                        </Pressable>
                    </View>

                    {nextWorkout && workoutStyle ? (
                        <View
                            style={[
                                styles.infoCard,
                                { flexDirection: "row", alignItems: "center" },
                            ]}
                        >
                            {/* Date Box */}
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

                            {/* Info */}
                            <View style={{ marginLeft: 15, flex: 1 }}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginBottom: 4,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor:
                                                workoutStyle.color + "20",
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            marginRight: 6,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: workoutStyle.color,
                                                fontSize: 10,
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {workoutStyle.name}
                                        </Text>
                                    </View>
                                    <Text style={styles.workoutTime}>
                                        {formatWorkoutTime(
                                            nextWorkout.scheduled_time
                                        )}
                                    </Text>
                                </View>

                                <Text
                                    style={styles.workoutTitle}
                                    numberOfLines={1}
                                >
                                    {nextWorkout.title}
                                </Text>

                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginTop: 4,
                                    }}
                                >
                                    <Ionicons
                                        name="time-outline"
                                        size={12}
                                        color="#B0B0B0"
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text
                                        style={{
                                            color: "#B0B0B0",
                                            fontSize: 12,
                                        }}
                                    >
                                        {nextWorkout.planned_duration} dk
                                    </Text>
                                </View>
                            </View>

                            {/* Icon */}
                            <View
                                style={{
                                    backgroundColor: COLORS.background,
                                    padding: 10,
                                    borderRadius: 20,
                                }}
                            >
                                <Ionicons
                                    name={workoutStyle.icon as any}
                                    size={24}
                                    color={workoutStyle.color}
                                />
                            </View>
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.infoCard,
                                {
                                    alignItems: "center",
                                    paddingVertical: 25,
                                    justifyContent: "center",
                                },
                            ]}
                        >
                            <Ionicons
                                name="bed-outline"
                                size={32}
                                color={COLORS.subText}
                                style={{ marginBottom: 8 }}
                            />
                            <Text
                                style={{ color: COLORS.subText, fontSize: 16 }}
                            >
                                Yaklaşan antrenman yok.
                            </Text>
                            <Text
                                style={{
                                    color: COLORS.subText,
                                    fontSize: 12,
                                    marginTop: 4,
                                }}
                            >
                                Yeni bir plan oluşturabilirsin.
                            </Text>
                        </View>
                    )}
                </Pressable>

                {/* GRID BUTTONS */}
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

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
};

export default HomeScreen;

// Styles remain the same (Use previous styles if needed, I'm omitting for brevity as requested)
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
