import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

// --- TİPLER ---
type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

export default function HomeCalendarScreen() {
    const { token, refreshUserData } = useContext(AuthContext);

    // Eğer ana sayfadan bir antrenman ID'si ile gelirsek onu yakalayalım
    const params = useLocalSearchParams();
    const { initialWorkoutId, initialDate } = params;

    const [weekDays, setWeekDays] = useState<any[]>([]);
    const [allWorkouts, setAllWorkouts] = useState<any[]>([]);

    // Takvimin şu an gösterdiği haftanın Pazartesi günü
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
    // Kullanıcının tıkladığı/seçtiği gün
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );

    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- YARDIMCI FONKSİYONLAR ---

    // Bir tarihin ait olduğu haftanın Pazartesisini bulur
    const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(date.setDate(diff));
    };

    const getWorkoutTypeStyle = (type: string) => {
        switch (type) {
            case "tempo":
                return {
                    icon: "speedometer",
                    color: COLORS.danger,
                    name: "Tempo Koşusu",
                    bgGradient: [COLORS.danger + "20", COLORS.card],
                };
            case "easy":
                return {
                    icon: "leaf",
                    color: COLORS.success,
                    name: "Hafif Koşu",
                    bgGradient: [COLORS.success + "20", COLORS.card],
                };
            case "interval":
                return {
                    icon: "flash",
                    color: COLORS.warning,
                    name: "İnterval",
                    bgGradient: [COLORS.warning + "20", COLORS.card],
                };
            case "long":
                return {
                    icon: "infinite",
                    color: COLORS.info,
                    name: "Uzun Koşu",
                    bgGradient: [COLORS.info + "20", COLORS.card],
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
                    bgGradient: [COLORS.secondary + "20", COLORS.card],
                };
        }
    };

    // --- VERİ ÇEKME ---
    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${API_URL}/workouts/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                setAllWorkouts(data);

                // Başlangıç tarihini ayarla (Parametre varsa oraya git, yoksa bugüne)
                let startTarget = new Date();

                if (initialDate) {
                    startTarget = new Date(initialDate as string);
                    setSelectedDate(initialDate as string);
                } else if (initialWorkoutId) {
                    const targetWorkout = data.find(
                        (w: any) => w.id === initialWorkoutId
                    );
                    if (targetWorkout) {
                        startTarget = new Date(targetWorkout.scheduled_date);
                        setSelectedDate(targetWorkout.scheduled_date);
                    }
                }

                setCurrentWeekStart(getMonday(startTarget));
            } catch (error) {
                console.log("Calendar fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    // --- HAFTAYI OLUŞTUR ---
    useEffect(() => {
        if (!currentWeekStart) return;

        const days = [];
        // Pazartesiden pazara 7 gün üret
        for (let i = 0; i < 7; i++) {
            const day = new Date(currentWeekStart);
            day.setDate(currentWeekStart.getDate() + i);
            const dateStr = day.toISOString().split("T")[0];

            // O güne ait antrenmanı bul
            const workout = allWorkouts.find(
                (w: any) => w.scheduled_date === dateStr
            );

            days.push({
                dayName: day
                    .toLocaleDateString("tr-TR", { weekday: "short" })
                    .toUpperCase(),
                dateNum: day.getDate(),
                fullDate: dateStr,
                workout: workout,
                isToday: new Date().toISOString().split("T")[0] === dateStr,
            });
        }
        setWeekDays(days);
    }, [currentWeekStart, allWorkouts]);

    // --- NAVİGASYON ---
    const changeWeek = (direction: "prev" | "next") => {
        const newStart = new Date(currentWeekStart);
        newStart.setDate(newStart.getDate() + (direction === "next" ? 7 : -7));
        setCurrentWeekStart(newStart);

        // Hafta değişince seçili günü de o haftanın Pazartesi'si yapalım (Opsiyonel)
        // setSelectedDate(newStart.toISOString().split('T')[0]);
    };

    // --- TAMAMLA BUTONU ---
    const handleMarkCompleted = () => {
        const workout = weekDays.find(
            (d) => d.fullDate === selectedDate
        )?.workout;
        if (!workout) return;

        Alert.alert(
            "Antrenmanı Tamamla",
            "Bu antrenmanı planlanan verilerle tamamlandı saymak istiyor musun?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Evet, Tamamla",
                    onPress: async () => {
                        setIsProcessing(true);
                        try {
                            // 1. Status Update
                            await fetch(`${API_URL}/workouts/${workout.id}/`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "completed" }),
                            });

                            // 2. Result Create
                            const resultData = {
                                workout: workout.id,
                                actual_date: workout.scheduled_date,
                                actual_duration: workout.planned_duration || 30,
                                actual_distance:
                                    workout.planned_distance || 5.0,
                                feeling: "normal",
                            };

                            await fetch(`${API_URL}/workout-results/`, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(resultData),
                            });

                            // 3. Verileri tazele
                            await refreshUserData();

                            // Local state güncelleme
                            const updatedWorkouts = allWorkouts.map((w) =>
                                w.id === workout.id
                                    ? { ...w, status: "completed" }
                                    : w
                            );
                            setAllWorkouts(updatedWorkouts);

                            Alert.alert(
                                "Harika!",
                                "Antrenman başarıyla kaydedildi."
                            );
                        } catch (error) {
                            Alert.alert(
                                "Hata",
                                "İşlem sırasında bir sorun oluştu."
                            );
                        } finally {
                            setIsProcessing(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    // Seçili günün antrenmanını bul
    const selectedDayData = weekDays.find((d) => d.fullDate === selectedDate);
    const selectedWorkout = selectedDayData?.workout;
    const typeStyle = selectedWorkout
        ? getWorkoutTypeStyle(selectedWorkout.workout_type)
        : null;

    // Ay ismi (Haftanın ilk gününe göre)
    const monthName = currentWeekStart.toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* --- CALENDAR STRIP (FIXED TOP) --- */}
            <View style={styles.calendarSection}>
                {/* Header: Ay ve Oklar */}
                <View style={styles.monthRow}>
                    <Pressable
                        onPress={() => changeWeek("prev")}
                        style={styles.arrowBtn}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={20}
                            color={COLORS.text}
                        />
                    </Pressable>

                    <Text style={styles.monthTitle}>{monthName}</Text>

                    <Pressable
                        onPress={() => changeWeek("next")}
                        style={styles.arrowBtn}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={COLORS.text}
                        />
                    </Pressable>
                </View>

                {/* Günler */}
                <View style={styles.daysRow}>
                    {weekDays.map((item, index) => {
                        const isSelected = item.fullDate === selectedDate;
                        return (
                            <Pressable
                                key={index}
                                style={[
                                    styles.dayItem,
                                    isSelected && styles.dayItemSelected,
                                    !isSelected &&
                                        item.isToday &&
                                        styles.dayItemToday,
                                ]}
                                onPress={() => setSelectedDate(item.fullDate)}
                            >
                                <Text
                                    style={[
                                        styles.dayName,
                                        isSelected && styles.textWhite,
                                        !isSelected &&
                                            item.isToday && {
                                                color: COLORS.accent,
                                            },
                                    ]}
                                >
                                    {item.dayName.charAt(0)}
                                </Text>
                                <Text
                                    style={[
                                        styles.dayNumber,
                                        isSelected && styles.textWhite,
                                        !isSelected &&
                                            item.isToday && {
                                                color: COLORS.accent,
                                            },
                                    ]}
                                >
                                    {item.dateNum}
                                </Text>

                                {/* Dot Indicator */}
                                <View
                                    style={[
                                        styles.dot,
                                        isSelected
                                            ? { backgroundColor: COLORS.white }
                                            : item.workout
                                            ? {
                                                  backgroundColor:
                                                      item.workout.status ===
                                                      "completed"
                                                          ? COLORS.success
                                                          : COLORS.accent,
                                              }
                                            : {
                                                  backgroundColor:
                                                      "transparent",
                                              },
                                    ]}
                                />
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* --- WORKOUT DETAIL --- */}
                <View style={styles.detailSection}>
                    {selectedWorkout ? (
                        <View>
                            {/* MAIN CARD */}
                            <LinearGradient
                                colors={
                                    (typeStyle?.bgGradient as any) || [
                                        COLORS.card,
                                        COLORS.card,
                                    ]
                                }
                                style={styles.mainCard}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.typeBadge}>
                                        <Ionicons
                                            name={typeStyle?.icon as any}
                                            size={16}
                                            color={typeStyle?.color}
                                        />
                                        <Text
                                            style={[
                                                styles.typeText,
                                                { color: typeStyle?.color },
                                            ]}
                                        >
                                            {typeStyle?.name}
                                        </Text>
                                    </View>
                                    {selectedWorkout.status === "completed" && (
                                        <View style={styles.completedBadge}>
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={16}
                                                color={COLORS.success}
                                            />
                                            <Text style={styles.completedText}>
                                                Tamamlandı
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.workoutTitle}>
                                    {selectedWorkout.title}
                                </Text>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaItem}>
                                        <Ionicons
                                            name="time-outline"
                                            size={18}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.metaValue}>
                                            {selectedWorkout.planned_duration}{" "}
                                            dk
                                        </Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.metaItem}>
                                        <Ionicons
                                            name="location-outline"
                                            size={18}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.metaValue}>
                                            {selectedWorkout.planned_distance}{" "}
                                            km
                                        </Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.metaItem}>
                                        <Ionicons
                                            name="speedometer-outline"
                                            size={18}
                                            color={COLORS.textDim}
                                        />
                                        <Text style={styles.metaValue}>
                                            {selectedWorkout.target_pace_seconds
                                                ? `${Math.floor(
                                                      selectedWorkout.target_pace_seconds /
                                                          60
                                                  )}:${(
                                                      selectedWorkout.target_pace_seconds %
                                                      60
                                                  )
                                                      .toString()
                                                      .padStart(2, "0")}`
                                                : "-"}
                                        </Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            {/* DESCRIPTION */}
                            <View style={styles.descCard}>
                                <Text style={styles.descLabel}>Açıklama</Text>
                                <Text style={styles.descText}>
                                    {selectedWorkout.description ||
                                        "Bu antrenman için özel bir not bulunmuyor. Hedeflerine odaklan ve koşunun tadını çıkar."}
                                </Text>
                            </View>

                            {/* ACTIONS */}
                            <View style={styles.actionContainer}>
                                {selectedWorkout.status !== "completed" ? (
                                    <Pressable
                                        style={styles.completeButton}
                                        onPress={handleMarkCompleted}
                                        disabled={isProcessing}
                                    >
                                        <LinearGradient
                                            colors={[
                                                COLORS.accent,
                                                COLORS.secondary,
                                            ]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientBtn}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Text
                                                        style={styles.btnText}
                                                    >
                                                        Antrenmanı Tamamla
                                                    </Text>
                                                    <Ionicons
                                                        name="checkmark-circle-outline"
                                                        size={22}
                                                        color="white"
                                                    />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </Pressable>
                                ) : (
                                    <View style={styles.disabledBtn}>
                                        <Text style={styles.disabledBtnText}>
                                            Bu antrenman tamamlandı 🎉
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : (
                        /* EMPTY STATE */
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons
                                    name="cafe-outline"
                                    size={40}
                                    color={COLORS.textDim}
                                />
                            </View>
                            <Text style={styles.emptyTitle}>Dinlenme Günü</Text>
                            <Text style={styles.emptyDesc}>
                                {new Date(selectedDate).toLocaleDateString(
                                    "tr-TR",
                                    { day: "numeric", month: "long" }
                                )}{" "}
                                tarihinde planlanmış bir antrenman yok.
                            </Text>
                            <Pressable
                                style={styles.addWorkoutBtn}
                                onPress={() =>
                                    router.push("/(protected)/chatbot")
                                }
                            >
                                <Text style={styles.addWorkoutText}>
                                    Yeni Plan Oluştur
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { justifyContent: "center", alignItems: "center" },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40, paddingTop: 20 },

    // CALENDAR STRIP
    calendarSection: {
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: COLORS.card,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 10,
    },
    monthRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: COLORS.text,
        textTransform: "capitalize",
    },
    arrowBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    daysRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 15,
    },
    dayItem: {
        alignItems: "center",
        justifyContent: "center",
        width: 45,
        height: 70,
        borderRadius: 25,
        backgroundColor: "transparent",
    },
    dayItemSelected: {
        backgroundColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
    },
    dayItemToday: {
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    dayName: {
        fontSize: 12,
        color: COLORS.textDim,
        marginBottom: 4,
        fontWeight: "600",
    },
    dayNumber: {
        fontSize: 16,
        fontWeight: "bold",
        color: COLORS.text,
    },
    textWhite: { color: "white" },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginTop: 6,
    },

    // DETAIL SECTION
    detailSection: {
        paddingHorizontal: 20,
    },

    // WORKOUT CARD
    mainCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: 20,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    typeBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.background,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: "bold",
        textTransform: "uppercase",
    },
    completedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    completedText: {
        color: COLORS.success,
        fontSize: 12,
        fontWeight: "bold",
    },
    workoutTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: COLORS.text,
        marginBottom: 20,
        lineHeight: 30,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(0,0,0,0.2)",
        padding: 15,
        borderRadius: 16,
    },
    metaItem: {
        alignItems: "center",
        flex: 1,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    metaValue: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 4,
    },

    // DESCRIPTION
    descCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: 25,
    },
    descLabel: {
        fontSize: 14,
        fontWeight: "bold",
        color: COLORS.textDim,
        marginBottom: 8,
        textTransform: "uppercase",
    },
    descText: {
        fontSize: 15,
        color: COLORS.text,
        lineHeight: 24,
    },

    // ACTIONS
    actionContainer: {
        marginBottom: 30,
    },
    completeButton: {
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    gradientBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 18,
        borderRadius: 18,
        gap: 10,
    },
    btnText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
    },
    disabledBtn: {
        backgroundColor: COLORS.card,
        paddingVertical: 18,
        borderRadius: 18,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    disabledBtnText: {
        color: COLORS.success,
        fontSize: 16,
        fontWeight: "bold",
    },

    // EMPTY STATE
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 40,
        padding: 20,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.card,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: COLORS.text,
        marginBottom: 10,
    },
    emptyDesc: {
        fontSize: 15,
        color: COLORS.textDim,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 20,
    },
    addWorkoutBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    addWorkoutText: {
        color: COLORS.accent,
        fontWeight: "600",
    },
});
