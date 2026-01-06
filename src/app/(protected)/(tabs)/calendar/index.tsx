import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");
// Kenar boşluklarını hesaba katarak kutu genişliği
const CELL_WIDTH = (width - 40) / 7;

// --- 1. LOCALE SETUP ---
LocaleConfig.locales["tr"] = {
    monthNames: [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
    ],
    monthNamesShort: [
        "Oca",
        "Şub",
        "Mar",
        "Nis",
        "May",
        "Haz",
        "Tem",
        "Ağu",
        "Eyl",
        "Eki",
        "Kas",
        "Ara",
    ],
    dayNames: [
        "Pazar",
        "Pazartesi",
        "Salı",
        "Çarşamba",
        "Perşembe",
        "Cuma",
        "Cumartesi",
    ],
    dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
    today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

// --- 2. RENK PALETİ ---
const THEME_COLORS = {
    tempo: "#FF4501",
    easy: "#4ECDC4",
    interval: "#FFD93D",
    long: "#A569BD",
    rest: "#B0A89E",
    default: "#FA7D09",
    missed: "#FF3B30", // Kaçırılanlar için Kırmızı
};

type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

const getWorkoutTheme = (type: WorkoutTypeEnum) => {
    switch (type) {
        case "tempo":
            return {
                color: THEME_COLORS.tempo,
                name: "Tempo",
                icon: "speedometer",
                bgGradient: [THEME_COLORS.tempo + "50", COLORS.card],
            };
        case "easy":
            return {
                color: THEME_COLORS.easy,
                name: "Hafif",
                icon: "leaf",
                bgGradient: [THEME_COLORS.easy + "50", COLORS.card],
            };
        case "interval":
            return {
                color: THEME_COLORS.interval,
                name: "İnterval",
                icon: "flash",
                bgGradient: [THEME_COLORS.interval + "50", COLORS.card],
            };
        case "long":
            return {
                color: THEME_COLORS.long,
                name: "Uzun",
                icon: "infinite",
                bgGradient: [THEME_COLORS.long + "50", COLORS.card],
            };
        case "rest":
            return {
                color: THEME_COLORS.rest,
                name: "Dinlenme",
                icon: "moon",
                bgGradient: [COLORS.cardVariant, COLORS.card],
            };
        default:
            return {
                color: THEME_COLORS.default,
                name: "Koşu",
                icon: "fitness",
                bgGradient: [THEME_COLORS.default + "50", COLORS.card],
            };
    }
};

const CalendarScreen = () => {
    const { token } = useContext(AuthContext);
    const params = useLocalSearchParams();

    // BUGÜNÜN TARİHİ (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split("T")[0];

    const [selectedDate, setSelectedDate] = useState(
        params.initialDate ? (params.initialDate as string) : todayStr
    );
    const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
    const [workoutsMap, setWorkoutsMap] = useState<any>({});
    const [refreshing, setRefreshing] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(
        params.initialDate ? (params.initialDate as string) : todayStr
    );

    useEffect(() => {
        if (params.initialDate) setSelectedDate(params.initialDate as string);
    }, [params.initialDate]);

    // --- DATA FETCHING ---
    const fetchWorkouts = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/workouts/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAllWorkouts(data);
                const map: any = {};
                data.forEach((w: any) => {
                    if (!map[w.scheduled_date]) map[w.scheduled_date] = w;
                });
                setWorkoutsMap(map);
            }
        } catch (error) {
            console.log("Fetch Error:", error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchWorkouts();
        }, [token])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchWorkouts();
        setRefreshing(false);
    };

    // --- ÖZELLEŞTİRİLMİŞ GÜN RENDER FONKSİYONU ---
    const renderCustomDay = ({
        date,
        state,
    }: {
        date: DateData;
        state: string;
    }) => {
        const dateStr = date.dateString;
        const workout = workoutsMap[dateStr];
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;
        const isCurrentMonth = state === "";

        const theme = workout ? getWorkoutTheme(workout.workout_type) : null;

        // Backend'den gelen statüleri kullanıyoruz
        const isCompleted = workout?.status === "completed";
        const isMissed = workout?.status === "missed"; // Backend'den güncel geldi

        // 1. SEÇİLİ GÜN
        if (isSelected) {
            return (
                <Pressable
                    onPress={() => setSelectedDate(dateStr)}
                    style={styles.dayContainer}
                >
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.secondary]}
                        style={styles.selectedDayBox}
                    >
                        <Text style={styles.selectedDayText}>{date.day}</Text>
                        {workout && <View style={styles.dotWhite} />}
                    </LinearGradient>
                </Pressable>
            );
        }

        // 2. DİĞER GÜNLER
        return (
            <Pressable
                onPress={() => setSelectedDate(dateStr)}
                style={[
                    styles.dayContainer,
                    !isCurrentMonth && { opacity: 0.8 },
                ]}
            >
                <View
                    style={[
                        styles.dayBox,

                        // A) BOŞ GÜN (KONTRAST YÜKSEK)
                        !workout && {
                            backgroundColor: "#333333",
                            borderColor: "#444444",
                            borderWidth: 1,
                        },

                        // B) ANTRENMAN GÜNÜ
                        workout && {
                            // Missed ise Kırmızı, Değilse Tema Rengi
                            borderColor: isMissed
                                ? THEME_COLORS.missed
                                : theme?.color,
                            borderWidth: 1.5,
                            // Missed ise Kırmızı şeffaf dolgu
                            backgroundColor: isMissed
                                ? THEME_COLORS.missed + "20"
                                : theme
                                ? theme.color + "30"
                                : "transparent",
                        },

                        // C) BUGÜN VURGUSU (Antrenman yoksa bile)
                        isToday &&
                            !workout && {
                                borderColor: COLORS.accent,
                                borderWidth: 1.5,
                                backgroundColor: "#333333",
                            },
                    ]}
                >
                    <Text
                        style={[
                            styles.dayText,
                            {
                                color: isToday
                                    ? COLORS.accent
                                    : workout
                                    ? COLORS.white
                                    : "#DDDDDD",
                                fontWeight: workout || isToday ? "800" : "600",
                            },
                        ]}
                    >
                        {date.day}
                    </Text>

                    {/* BUGÜN BELİRTECİ (ALT ÇİZGİ - BAR) */}
                    {isToday && (
                        <View
                            style={{
                                width: 16,
                                height: 3,
                                borderRadius: 2,
                                backgroundColor: COLORS.accent,
                                marginTop: 4,
                            }}
                        />
                    )}

                    {/* --- DURUM İKONLARI (SAĞ ÜST) --- */}

                    {/* 1. Tamamlandı (YEŞİL TİK) */}
                    {isCompleted && (
                        <View style={styles.statusIcon}>
                            <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={COLORS.success}
                            />
                        </View>
                    )}

                    {/* 2. Kaçırıldı (KIRMIZI ÇARPI) */}
                    {isMissed && (
                        <View style={styles.statusIcon}>
                            <Ionicons
                                name="close-circle"
                                size={14}
                                color={THEME_COLORS.missed}
                            />
                        </View>
                    )}
                </View>
            </Pressable>
        );
    };

    const selectedWorkout = workoutsMap[selectedDate];

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Takvim</Text>
                <View style={styles.headerStats}>
                    <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={COLORS.accent}
                    />
                    <Text style={styles.headerStatsText}>
                        {allWorkouts.length} Plan
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.accent}
                    />
                }
            >
                <View style={styles.calendarContainer}>
                    <Calendar
                        current={currentMonth}
                        firstDay={1}
                        dayComponent={renderCustomDay}
                        onMonthChange={(date: any) =>
                            setCurrentMonth(date.dateString)
                        }
                        theme={{
                            calendarBackground: "transparent",
                            textSectionTitleColor: "#BBBBBB",
                            monthTextColor: COLORS.text,
                            textMonthFontSize: 22,
                            textMonthFontWeight: "800",
                            textDayHeaderFontSize: 13,
                            textDayHeaderFontWeight: "700",
                            arrowColor: COLORS.accent,
                            "stylesheet.calendar.header": {
                                header: {
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    paddingLeft: 10,
                                    paddingRight: 10,
                                    marginBottom: 20,
                                    alignItems: "center",
                                },
                                week: {
                                    flexDirection: "row",
                                    justifyContent: "space-around",
                                    paddingBottom: 10,
                                    marginBottom: 5,
                                    borderBottomWidth: 0,
                                },
                            },
                        }}
                    />
                </View>

                {/* --- DETAIL SECTION (TICKET) --- */}
                <View style={styles.detailsSection}>
                    <Text style={styles.detailsDate}>
                        {new Date(selectedDate).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            weekday: "long",
                        })}
                    </Text>

                    {selectedWorkout ? (
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: "/calendar/detail_modal",
                                    params: { workoutId: selectedWorkout.id },
                                })
                            }
                        >
                            {(() => {
                                const theme = getWorkoutTheme(
                                    selectedWorkout.workout_type
                                );
                                const isCompleted =
                                    selectedWorkout.status === "completed";
                                const isMissed =
                                    selectedWorkout.status === "missed";

                                return (
                                    <LinearGradient
                                        colors={theme.bgGradient as any}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.gradientTicket}
                                    >
                                        <View style={styles.ticketLeft}>
                                            <View
                                                style={[
                                                    styles.iconBox,
                                                    {
                                                        borderColor:
                                                            theme.color,
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name={theme.icon as any}
                                                    size={22}
                                                    color={theme.color}
                                                />
                                            </View>
                                            <Text style={styles.ticketTime}>
                                                {selectedWorkout.scheduled_time
                                                    ? selectedWorkout.scheduled_time.slice(
                                                          0,
                                                          5
                                                      )
                                                    : "--:--"}
                                            </Text>
                                        </View>

                                        <View style={styles.ticketCenter}>
                                            <View
                                                style={styles.ticketHeaderRow}
                                            >
                                                <Text
                                                    style={[
                                                        styles.ticketType,
                                                        { color: theme.color },
                                                    ]}
                                                >
                                                    {theme.name}
                                                </Text>

                                                {/* TAMAMLANDI BADGE */}
                                                {isCompleted && (
                                                    <View
                                                        style={[
                                                            styles.badge,
                                                            {
                                                                backgroundColor:
                                                                    theme.color,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.badgeText
                                                            }
                                                        >
                                                            BİTTİ
                                                        </Text>
                                                    </View>
                                                )}

                                                {/* KAÇIRILDI BADGE */}
                                                {isMissed && (
                                                    <View
                                                        style={[
                                                            styles.badge,
                                                            {
                                                                backgroundColor:
                                                                    THEME_COLORS.missed,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={
                                                                styles.badgeText
                                                            }
                                                        >
                                                            KAÇIRILDI
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text
                                                style={styles.ticketTitle}
                                                numberOfLines={1}
                                            >
                                                {selectedWorkout.title}
                                            </Text>
                                            <View style={styles.ticketMetaRow}>
                                                <Ionicons
                                                    name="timer-outline"
                                                    size={14}
                                                    color={COLORS.textDim}
                                                />
                                                <Text
                                                    style={
                                                        styles.ticketMetaText
                                                    }
                                                >
                                                    {
                                                        selectedWorkout.planned_duration
                                                    }{" "}
                                                    dk
                                                </Text>
                                                {selectedWorkout.planned_distance >
                                                    0 && (
                                                    <>
                                                        <Text
                                                            style={
                                                                styles.ticketDivider
                                                            }
                                                        >
                                                            •
                                                        </Text>
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
                                                                selectedWorkout.planned_distance
                                                            }{" "}
                                                            km
                                                        </Text>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={24}
                                            color={COLORS.cardBorder}
                                        />
                                    </LinearGradient>
                                );
                            })()}
                        </Pressable>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons
                                name="calendar-clear-outline"
                                size={32}
                                color={COLORS.textDim}
                            />
                            <Text style={styles.emptyDesc}>
                                Planlanmış antrenman yok.
                            </Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default CalendarScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: "900",
        color: COLORS.text,
        letterSpacing: 0.5,
    },
    headerStats: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.card,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        gap: 6,
    },
    headerStatsText: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
    },
    // CALENDAR GRID
    calendarContainer: {
        marginHorizontal: 10,
        paddingVertical: 10,
    },
    dayContainer: {
        width: CELL_WIDTH,
        height: CELL_WIDTH,
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 4,
    },
    dayBox: {
        width: CELL_WIDTH - 6,
        height: CELL_WIDTH - 6,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 14,
        // Border render'da handle ediliyor
    },
    selectedDayBox: {
        width: CELL_WIDTH - 2,
        height: CELL_WIDTH - 2,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
        elevation: 8,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    dayText: {
        fontSize: 14,
    },
    selectedDayText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: "900",
    },
    dotWhite: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: COLORS.white,
        marginTop: 4,
    },
    // ORTAK STATUS ICON STİLİ (TIK ve X için)
    statusIcon: {
        position: "absolute",
        top: -6,
        right: -6,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        padding: 1,
        zIndex: 2,
    },
    // TICKET / DETAILS
    detailsSection: {
        paddingHorizontal: 20,
        marginTop: 15,
    },
    detailsDate: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 15,
        marginLeft: 5,
    },
    gradientTicket: {
        flexDirection: "row",
        alignItems: "center",
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    ticketLeft: {
        alignItems: "center",
        justifyContent: "center",
        marginRight: 15,
        width: 50,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        marginBottom: 6,
    },
    ticketTime: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
    },
    ticketCenter: {
        flex: 1,
    },
    ticketHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
        gap: 8,
    },
    ticketType: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    ticketTitle: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: "700",
        marginBottom: 6,
    },
    ticketMetaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    ticketMetaText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
    },
    ticketDivider: {
        color: COLORS.textDim,
        marginHorizontal: 4,
        fontSize: 10,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        color: COLORS.background,
        fontSize: 9,
        fontWeight: "900",
    },
    emptyState: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 25,
        alignItems: "center",
        flexDirection: "row",
        gap: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: "dashed",
    },
    emptyDesc: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "600",
    },
});
