import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
// useMemo'yu import etmeyi unutma
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
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
import { API_URL } from "@/constants/Config";
// Yeni oluşturduğumuz içerik dosyasını import et
import { HEADER_IMAGES, MOTIVATION_QUOTES } from "@/constants/Content";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

// --- TYPES ---
type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

type Workout = {
    id: string;
    title: string;
    workout_type: WorkoutTypeEnum;
    scheduled_date: string;
    planned_duration: number;
    planned_distance: number;
    status: "scheduled" | "completed" | "missed" | "skipped";
    is_completed: boolean;
};

// --- HELPERS ---
const getWorkoutTypeStyle = (type: WorkoutTypeEnum) => {
    switch (type) {
        case "tempo":
            return {
                icon: "speedometer",
                color: COLORS.danger,
                name: "Tempo Koşusu",
                bgGradient: [COLORS.danger + "40", COLORS.card],
            };
        case "easy":
            return {
                icon: "leaf",
                color: COLORS.success,
                name: "Hafif Koşu",
                bgGradient: [COLORS.success + "40", COLORS.card],
            };
        case "interval":
            return {
                icon: "flash",
                color: COLORS.warning,
                name: "İnterval",
                bgGradient: [COLORS.warning + "40", COLORS.card],
            };
        case "long":
            return {
                icon: "infinite",
                color: COLORS.info,
                name: "Uzun Koşu",
                bgGradient: [COLORS.info + "40", COLORS.card],
            };
        case "rest":
            return {
                icon: "moon",
                color: COLORS.textDim,
                name: "Dinlenme",
                bgGradient: [COLORS.cardVariant, COLORS.card],
            };
        default:
            return {
                icon: "fitness",
                color: COLORS.secondary,
                name: "Koşu",
                bgGradient: [COLORS.secondary + "40", COLORS.card],
            };
    }
};

const HomeScreen = () => {
    const { user, token, refreshUserData } = useContext(AuthContext);
    const [refreshing, setRefreshing] = useState(false);
    const [nextWorkout, setNextWorkout] = useState<Workout | null>(null);

    // --- RANDOM CONTENT LOGIC ---
    // useMemo kullanarak sadece component ilk yüklendiğinde rastgele seçim yapmasını sağlıyoruz.
    // Her render'da değişmemesi için bu önemli.
    const randomQuote = useMemo(() => {
        const randomIndex = Math.floor(
            Math.random() * MOTIVATION_QUOTES.length
        );
        return MOTIVATION_QUOTES[randomIndex];
    }, []);

    const randomImage = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * HEADER_IMAGES.length);
        return HEADER_IMAGES[randomIndex];
    }, []);

    // --- DATA FETCHING ---
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
                    return (
                        wDate >= today &&
                        !w.is_completed &&
                        w.status !== "completed"
                    );
                });

                upcomingWorkouts.sort(
                    (a, b) =>
                        new Date(a.scheduled_date).getTime() -
                        new Date(b.scheduled_date).getTime()
                );
                setNextWorkout(
                    upcomingWorkouts.length > 0 ? upcomingWorkouts[0] : null
                );
            }
        } catch (error) {
            console.log("Workout fetch error:", error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNextWorkout();
            refreshUserData();
        }, [token])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refreshUserData(), fetchNextWorkout()]);
        setRefreshing(false);
    }, []);

    const formatWorkoutDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = date.getTime() === today.getTime();

        return {
            day: date.getDate(),
            month: date
                .toLocaleDateString("tr-TR", { month: "short" })
                .toUpperCase(),
            isToday: isToday,
        };
    };

    if (!user) {
        return (
            <View style={[styles.mainContainer, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    // --- UI VARS ---
    const formattedName = user.first_name ? user.first_name : user.username;
    const totalWorkouts = user.total_workouts || 0;
    const totalDistance = user.total_distance?.toFixed(1) || "0.0";
    const streak = user.current_streak || 0;

    const hasExistingPlan = totalWorkouts > 0 || nextWorkout !== null;

    const workoutStyle = nextWorkout
        ? getWorkoutTypeStyle(nextWorkout.workout_type)
        : null;
    const dateInfo = nextWorkout
        ? formatWorkoutDate(nextWorkout.scheduled_date)
        : null;

    return (
        <View style={styles.mainContainer}>
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

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
                        progressViewOffset={StatusBar.currentHeight}
                    />
                }
            >
                {/* --- HERO HEADER (FULL WIDTH & DYNAMIC) --- */}
                <View style={styles.heroContainer}>
                    <ImageBackground
                        source={randomImage} // <-- ARTIK RASTGELE RESİM
                        style={styles.heroImage}
                    >
                        <LinearGradient
                            colors={["transparent", COLORS.background]}
                            style={styles.heroGradient}
                        >
                            <View style={styles.heroTextContainer}>
                                <Text style={styles.heroGreeting}>
                                    Selam, {formattedName}
                                </Text>
                                {/* --- RASTGELE MOTİVASYON SÖZÜ --- */}
                                <Text style={styles.heroMotivation}>
                                    {randomQuote}
                                </Text>
                            </View>
                        </LinearGradient>
                    </ImageBackground>
                </View>

                <View style={styles.contentOverlappingContainer}>
                    {/* --- PLAN YOKSA --- */}
                    {!hasExistingPlan ? (
                        <View style={styles.noPlanContainer}>
                            <View style={styles.noPlanIconCircle}>
                                <Ionicons
                                    name="footsteps"
                                    size={48}
                                    color={COLORS.accent}
                                />
                            </View>
                            <Text style={styles.noPlanTitle}>İlk Adımı At</Text>
                            <Text style={styles.noPlanDesc}>
                                Henüz aktif bir koşu planın görünmüyor. Yapay
                                zeka koçunla tanış ve hedefine uygun sana özel
                                programı hemen oluştur.
                            </Text>

                            <Link href={"/chatbot"} asChild>
                                <Pressable style={styles.createPlanButtonLarge}>
                                    <LinearGradient
                                        colors={[
                                            COLORS.accent,
                                            COLORS.secondary,
                                        ]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.createPlanGradient}
                                    >
                                        <Text
                                            style={styles.createPlanButtonText}
                                        >
                                            AI ile Plan Oluştur
                                        </Text>
                                        <Ionicons
                                            name="arrow-forward-circle"
                                            size={28}
                                            color={COLORS.white}
                                        />
                                    </LinearGradient>
                                </Pressable>
                            </Link>
                            <View style={styles.emptyStatsRow}>
                                <Text style={styles.emptyStatsText}>
                                    0 km Mesafe • 0 Antrenman
                                </Text>
                            </View>
                        </View>
                    ) : (
                        /* --- PLAN VARSA --- */
                        <>
                            {/* FLOATING STATS ROW */}
                            <View style={styles.floatingStatsContainer}>
                                {/* Distance (SOL) */}
                                <Link href={"/progress"} asChild push>
                                    <Pressable
                                        style={[
                                            styles.statCard,
                                            styles.statCardMain,
                                        ]}
                                    >
                                        <View style={styles.statIconRow}>
                                            <Ionicons
                                                name="map"
                                                size={20}
                                                color={COLORS.accent}
                                                style={styles.statIcon}
                                            />
                                            <Text style={styles.statLabelMain}>
                                                Toplam Mesafe
                                            </Text>
                                        </View>
                                        <Text style={styles.statValueMain}>
                                            {totalDistance}{" "}
                                            <Text style={styles.statUnitMain}>
                                                km
                                            </Text>
                                        </Text>
                                    </Pressable>
                                </Link>

                                {/* SAĞ SÜTUN (FIXED) */}
                                <View style={styles.statsColumnRight}>
                                    <Link href={"/progress"} asChild push>
                                        <Pressable style={styles.statCardSmall}>
                                            <View
                                                style={[
                                                    styles.iconBoxSmall,
                                                    {
                                                        backgroundColor:
                                                            COLORS.secondary +
                                                            "20",
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="fitness"
                                                    size={18}
                                                    color={COLORS.secondary}
                                                />
                                            </View>
                                            <View>
                                                <Text
                                                    style={
                                                        styles.statValueSmall
                                                    }
                                                >
                                                    {totalWorkouts}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.statLabelSmall
                                                    }
                                                >
                                                    Antrenman
                                                </Text>
                                            </View>
                                        </Pressable>
                                    </Link>

                                    <Link href={"/progress"} asChild push>
                                        <Pressable style={styles.statCardSmall}>
                                            <View
                                                style={[
                                                    styles.iconBoxSmall,
                                                    {
                                                        backgroundColor:
                                                            COLORS.warning +
                                                            "20",
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="flame"
                                                    size={18}
                                                    color={COLORS.warning}
                                                />
                                            </View>
                                            <View>
                                                <Text
                                                    style={
                                                        styles.statValueSmall
                                                    }
                                                >
                                                    {streak} Gün
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.statLabelSmall
                                                    }
                                                >
                                                    Seri
                                                </Text>
                                            </View>
                                        </Pressable>
                                    </Link>
                                </View>
                            </View>

                            {/* NEXT WORKOUT TICKET */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    Sıradaki Hedefin
                                </Text>
                                <Pressable
                                    onPress={() =>
                                        router.push(
                                            nextWorkout
                                                ? {
                                                      pathname:
                                                          "/calendar_modal",
                                                      params: {
                                                          workoutId:
                                                              nextWorkout.id,
                                                      },
                                                  }
                                                : "/calendar_modal"
                                        )
                                    }
                                >
                                    {nextWorkout && workoutStyle && dateInfo ? (
                                        <LinearGradient
                                            colors={
                                                workoutStyle.bgGradient as any
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.workoutTicket}
                                        >
                                            <View style={styles.ticketLeft}>
                                                <View
                                                    style={[
                                                        styles.ticketDateBox,
                                                        dateInfo.isToday &&
                                                            styles.ticketDateBoxToday,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.ticketDay,
                                                            dateInfo.isToday && {
                                                                color: COLORS.background,
                                                            },
                                                        ]}
                                                    >
                                                        {dateInfo.day}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.ticketMonth,
                                                            dateInfo.isToday && {
                                                                color: COLORS.background,
                                                            },
                                                        ]}
                                                    >
                                                        {dateInfo.isToday
                                                            ? "BUGÜN"
                                                            : dateInfo.month}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={styles.ticketIconBox}
                                                >
                                                    <Ionicons
                                                        name={
                                                            workoutStyle.icon as any
                                                        }
                                                        size={24}
                                                        color={
                                                            workoutStyle.color
                                                        }
                                                    />
                                                </View>
                                            </View>

                                            <View style={styles.ticketContent}>
                                                <Text
                                                    style={[
                                                        styles.ticketType,
                                                        {
                                                            color: workoutStyle.color,
                                                        },
                                                    ]}
                                                >
                                                    {workoutStyle.name}
                                                </Text>
                                                <Text
                                                    style={styles.ticketTitle}
                                                    numberOfLines={2}
                                                >
                                                    {nextWorkout.title}
                                                </Text>
                                                <View
                                                    style={styles.ticketMetaRow}
                                                >
                                                    <View
                                                        style={
                                                            styles.ticketMetaItem
                                                        }
                                                    >
                                                        <Ionicons
                                                            name="time-outline"
                                                            size={14}
                                                            color={
                                                                COLORS.textDim
                                                            }
                                                        />
                                                        <Text
                                                            style={
                                                                styles.ticketMetaText
                                                            }
                                                        >
                                                            {
                                                                nextWorkout.planned_duration
                                                            }{" "}
                                                            dk
                                                        </Text>
                                                    </View>
                                                    {nextWorkout.planned_distance >
                                                        0 && (
                                                        <View
                                                            style={
                                                                styles.ticketMetaItem
                                                            }
                                                        >
                                                            <Ionicons
                                                                name="location-outline"
                                                                size={14}
                                                                color={
                                                                    COLORS.textDim
                                                                }
                                                            />
                                                            <Text
                                                                style={
                                                                    styles.ticketMetaText
                                                                }
                                                            >
                                                                {
                                                                    nextWorkout.planned_distance
                                                                }{" "}
                                                                km
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <Ionicons
                                                name="chevron-forward"
                                                size={24}
                                                color={COLORS.cardBorder}
                                                style={{ alignSelf: "center" }}
                                            />
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.emptyWorkoutTicket}>
                                            <Ionicons
                                                name="calendar-clear-outline"
                                                size={32}
                                                color={COLORS.textDim}
                                            />
                                            <Text
                                                style={styles.emptyTicketText}
                                            >
                                                Yaklaşan koşu planı yok.
                                            </Text>
                                            <Text
                                                style={
                                                    styles.emptyTicketSubText
                                                }
                                            >
                                                Takvimden yeni bir antrenman
                                                ekleyebilirsin.
                                            </Text>
                                        </View>
                                    )}
                                </Pressable>
                            </View>

                            {/* QUICK LINKS */}
                            <View style={styles.quickLinksRow}>
                                <Link href={"/plans"} asChild push>
                                    <Pressable style={styles.quickLinkButton}>
                                        <Ionicons
                                            name="list-outline"
                                            size={22}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.quickLinkText}>
                                            Tüm Planlar
                                        </Text>
                                    </Pressable>
                                </Link>
                                <Link href={"/progress"} asChild push>
                                    <Pressable style={styles.quickLinkButton}>
                                        <Ionicons
                                            name="stats-chart-outline"
                                            size={22}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.quickLinkText}>
                                            Detaylı Analiz
                                        </Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </>
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default HomeScreen;

// --- STYLING (THEMED) ---
const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },

    // HERO HEADER
    heroContainer: {
        height: 320,
        width: width,
        backgroundColor: COLORS.card,
    },
    heroImage: {
        flex: 1,
        justifyContent: "flex-end",
    },
    heroGradient: {
        height: "100%",
        justifyContent: "flex-end",
        paddingHorizontal: 20,
        paddingBottom: 50,
    },
    heroTextContainer: {
        marginBottom: 20,
    },
    heroGreeting: {
        color: COLORS.white,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: 0.5,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    heroMotivation: {
        color: COLORS.textDim, // Biraz daha yumuşak renk
        fontSize: 16,
        fontWeight: "600",
        marginTop: 8,
        fontStyle: "italic", // Alıntı olduğu için italik güzel durur
        textShadowColor: "rgba(0, 0, 0, 0.5)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // CONTENT CONTAINER
    contentOverlappingContainer: {
        paddingHorizontal: 20,
        marginTop: -40,
        zIndex: 10,
    },

    // --- NO PLAN STATE ---
    noPlanContainer: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 30,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    noPlanIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    noPlanTitle: {
        color: COLORS.text,
        fontSize: 26,
        fontWeight: "bold",
        marginBottom: 12,
        textAlign: "center",
    },
    noPlanDesc: {
        color: COLORS.textDim,
        fontSize: 16,
        textAlign: "center",
        marginBottom: 25,
        lineHeight: 24,
    },
    createPlanButtonLarge: {
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        marginBottom: 20,
    },
    createPlanGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    createPlanButtonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: "bold",
    },
    emptyStatsRow: {
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        paddingTop: 15,
        width: "100%",
        alignItems: "center",
    },
    emptyStatsText: {
        color: COLORS.inactive,
        fontSize: 14,
        fontWeight: "600",
    },

    // --- ACTIVE STATE ---

    // Floating Stats
    floatingStatsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 30,
    },
    statCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    statCardMain: {
        flex: 1.2,
        justifyContent: "space-between",
        height: 160,
    },
    statsColumnRight: {
        flex: 1,
        justifyContent: "space-between",
        gap: 12, // DİKEY BOŞLUK
        height: 160,
    },
    statCardSmall: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
        justifyContent: "flex-start",
    },
    iconBoxSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    statIconRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    statIcon: {
        marginRight: 8,
    },
    statLabelMain: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    statValueMain: {
        color: COLORS.text,
        fontSize: 36,
        fontWeight: "900",
    },
    statUnitMain: {
        fontSize: 18,
        color: COLORS.accent,
        fontWeight: "600",
    },
    statValueSmall: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    statLabelSmall: {
        color: COLORS.textDim,
        fontSize: 12,
    },

    // Section
    sectionContainer: {
        marginBottom: 25,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 15,
        marginLeft: 5,
    },

    // Next Workout Ticket
    workoutTicket: {
        borderRadius: 22,
        padding: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: "row",
        minHeight: 110,
    },
    ticketLeft: {
        justifyContent: "space-between",
        alignItems: "center",
        marginRight: 15,
    },
    ticketDateBox: {
        backgroundColor: COLORS.background,
        borderRadius: 14,
        width: 55,
        height: 60,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    ticketDateBoxToday: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    ticketDay: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "800",
    },
    ticketMonth: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: "700",
    },
    ticketIconBox: {
        marginTop: 10,
    },
    ticketContent: {
        flex: 1,
        justifyContent: "center",
    },
    ticketType: {
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 6,
    },
    ticketTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 10,
        lineHeight: 22,
    },
    ticketMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 15,
    },
    ticketMetaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    ticketMetaText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
    },
    emptyWorkoutTicket: {
        backgroundColor: COLORS.cardVariant,
        borderRadius: 22,
        padding: 25,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: "dashed",
    },
    emptyTicketText: {
        color: COLORS.textDim,
        fontSize: 16,
        fontWeight: "600",
        marginTop: 10,
    },
    emptyTicketSubText: {
        color: COLORS.inactive,
        fontSize: 13,
        marginTop: 5,
    },

    // Quick Links
    quickLinksRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        marginTop: 10,
    },
    quickLinkButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.card,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        gap: 8,
    },
    quickLinkText: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "600",
    },
});
