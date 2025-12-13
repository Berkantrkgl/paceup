import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

const API_URL = "http://127.0.0.1:8000/api";

export default function CalendarModal() {
    const { token, refreshUserData } = useContext(AuthContext);
    const params = useLocalSearchParams();
    const { workoutId } = params;

    const [weekDays, setWeekDays] = useState<any[]>([]);
    const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false); // Buton için loading

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${API_URL}/workouts/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const allWorkouts = await response.json();

                // Referans tarih belirle
                let referenceDate = new Date();
                if (workoutId) {
                    const target = allWorkouts.find(
                        (w: any) => w.id === workoutId
                    );
                    if (target) referenceDate = new Date(target.scheduled_date);
                }

                // Haftayı oluştur
                const days = [];
                for (let i = -3; i <= 3; i++) {
                    const day = new Date(referenceDate);
                    day.setDate(referenceDate.getDate() + i);
                    const dateStr = day.toISOString().split("T")[0];

                    const workout = allWorkouts.find(
                        (w: any) => w.scheduled_date === dateStr
                    );

                    days.push({
                        dayName: day.toLocaleDateString("tr-TR", {
                            weekday: "short",
                        }),
                        dateNum: day.getDate(),
                        fullDate: dateStr,
                        workout: workout,
                    });
                }

                setWeekDays(days);
                setSelectedIndex(3); // Ortadaki gün
                setSelectedWorkout(days[3].workout);
            } catch (error) {
                console.log(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, workoutId]);

    const handleDayPress = (index: number) => {
        setSelectedIndex(index);
        setSelectedWorkout(weekDays[index].workout);
    };

    const handleGoToDetail = () => {
        if (selectedWorkout) {
            router.push({
                pathname: "/calendar/detail_modal",
                params: { workoutId: selectedWorkout.id },
            });
        }
    };

    // --- ANTREMANI TAMAMLA (HIZLI AKSİYON) ---
    const handleMarkCompleted = () => {
        if (!selectedWorkout) return;

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
                            // 1. Durumu güncelle
                            await fetch(
                                `${API_URL}/workouts/${selectedWorkout.id}/`,
                                {
                                    method: "PATCH",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        status: "completed",
                                    }),
                                }
                            );

                            // 2. Result oluştur (Grafikler için gerekli)
                            const resultData = {
                                workout: selectedWorkout.id,
                                actual_date: selectedWorkout.scheduled_date,
                                actual_start_time:
                                    selectedWorkout.scheduled_time ||
                                    "08:00:00",
                                actual_duration:
                                    selectedWorkout.planned_duration || 30,
                                actual_distance:
                                    selectedWorkout.planned_distance || 5.0,
                                actual_pace:
                                    selectedWorkout.target_pace || "6:00",
                                feeling: "good",
                                difficulty_rating: 3,
                                calories_burned: Math.round(
                                    (selectedWorkout.planned_distance || 5) * 70
                                ),
                            };

                            await fetch(`${API_URL}/results/`, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(resultData),
                            });

                            // 3. Context'i yenile ve çık
                            await refreshUserData();
                            Alert.alert("Harika!", "Antrenman kaydedildi.");
                            router.back();
                        } catch (error) {
                            Alert.alert("Hata", "İşlem başarısız oldu.");
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

    const getWorkoutTypeInfo = (type: string) => {
        switch (type) {
            case "tempo":
                return {
                    name: "Tempo",
                    icon: "speedometer-outline",
                    color: "#FF6B6B",
                };
            case "easy":
                return {
                    name: "Hafif",
                    icon: "walk-outline",
                    color: "#4ECDC4",
                };
            case "interval":
                return {
                    name: "İnterval",
                    icon: "flash-outline",
                    color: "#FFD93D",
                };
            case "long":
                return {
                    name: "Uzun",
                    icon: "trending-up-outline",
                    color: "#A569BD",
                };
            case "rest":
                return {
                    name: "Dinlenme",
                    icon: "moon-outline",
                    color: "#95A5A6",
                };
            default:
                return {
                    name: "Antrenman",
                    icon: "fitness-outline",
                    color: COLORS.accent,
                };
        }
    };

    const typeInfo = selectedWorkout
        ? getWorkoutTypeInfo(selectedWorkout.workout_type)
        : null;

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Haftalık Takvim */}
                <View style={styles.section}>
                    <View style={styles.calendarHeader}>
                        <Text style={styles.sectionTitle}>
                            {weekDays.length > 0 &&
                                new Date(
                                    weekDays[selectedIndex]?.fullDate
                                ).toLocaleDateString("tr-TR", {
                                    month: "long",
                                    year: "numeric",
                                })}
                        </Text>
                        <Pressable
                            style={styles.fullCalendarButton}
                            onPress={() => router.push("/(tabs)/calendar")}
                        >
                            <Text style={styles.fullCalendarButtonText}>
                                Tüm Takvim
                            </Text>
                            <Ionicons
                                name="calendar-outline"
                                size={18}
                                color={COLORS.accent}
                            />
                        </Pressable>
                    </View>

                    <View style={styles.weekContainer}>
                        {weekDays.map((item, index) => (
                            <Pressable
                                key={index}
                                style={[
                                    styles.dayCard,
                                    selectedIndex === index &&
                                        styles.dayCardSelected,
                                    item.workout && styles.dayCardWithWorkout,
                                ]}
                                onPress={() => handleDayPress(index)}
                            >
                                <Text
                                    style={[
                                        styles.dayText,
                                        selectedIndex === index &&
                                            styles.dayTextSelected,
                                    ]}
                                >
                                    {item.dayName}
                                </Text>
                                <Text
                                    style={[
                                        styles.dateText,
                                        selectedIndex === index &&
                                            styles.dateTextSelected,
                                    ]}
                                >
                                    {item.dateNum}
                                </Text>
                                {item.workout && (
                                    <View
                                        style={[
                                            styles.workoutDot,
                                            selectedIndex === index &&
                                                styles.workoutDotSelected,
                                            {
                                                backgroundColor:
                                                    item.workout.status ===
                                                    "completed"
                                                        ? "#4CAF50"
                                                        : COLORS.accent,
                                            },
                                        ]}
                                    />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Seçili Antrenman */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Antrenman Detayı</Text>

                    {selectedWorkout ? (
                        <>
                            {/* Ana Bilgi Kartı */}
                            <View style={styles.workoutCard}>
                                <View style={styles.workoutHeader}>
                                    <View style={styles.iconCircle}>
                                        <Ionicons
                                            name={typeInfo?.icon as any}
                                            size={28}
                                            color={COLORS.accent}
                                        />
                                    </View>
                                    <View style={styles.workoutHeaderText}>
                                        <Text style={styles.workoutTitle}>
                                            {selectedWorkout.title}
                                        </Text>
                                        <Text style={styles.workoutTime}>
                                            <Ionicons
                                                name="time-outline"
                                                size={14}
                                                color="#B0B0B0"
                                            />{" "}
                                            {selectedWorkout.scheduled_time?.slice(
                                                0,
                                                5
                                            ) || "Tüm Gün"}
                                        </Text>
                                    </View>
                                    {selectedWorkout.status === "completed" ? (
                                        <View style={styles.completedTag}>
                                            <Ionicons
                                                name="checkmark"
                                                size={12}
                                                color="white"
                                            />
                                            <Text
                                                style={styles.completedTagText}
                                            >
                                                Tamamlandı
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.typeTag}>
                                            <Text style={styles.typeTagText}>
                                                {typeInfo?.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* İstatistikler */}
                                <View style={styles.statsRow}>
                                    <View style={styles.statBox}>
                                        <Ionicons
                                            name="timer-outline"
                                            size={24}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.statLabel}>
                                            Süre
                                        </Text>
                                        <Text style={styles.statValue}>
                                            {selectedWorkout.planned_duration}{" "}
                                            dk
                                        </Text>
                                    </View>

                                    <View style={styles.statDivider} />

                                    <View style={styles.statBox}>
                                        <Ionicons
                                            name="navigate-outline"
                                            size={24}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.statLabel}>
                                            Mesafe
                                        </Text>
                                        <Text style={styles.statValue}>
                                            {selectedWorkout.planned_distance}{" "}
                                            km
                                        </Text>
                                    </View>

                                    <View style={styles.statDivider} />

                                    <View style={styles.statBox}>
                                        <Ionicons
                                            name="speedometer-outline"
                                            size={24}
                                            color={COLORS.accent}
                                        />
                                        <Text style={styles.statLabel}>
                                            Tempo
                                        </Text>
                                        <Text style={styles.statValue}>
                                            {selectedWorkout.target_pace || "-"}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Açıklama */}
                            <View style={styles.infoCard}>
                                <View style={styles.infoCardHeader}>
                                    <Ionicons
                                        name="information-circle"
                                        size={22}
                                        color={COLORS.accent}
                                    />
                                    <Text style={styles.infoCardTitle}>
                                        Açıklama & Hedef
                                    </Text>
                                </View>
                                <Text style={styles.infoCardText}>
                                    {selectedWorkout.description ||
                                        "Bu antrenman için özel bir açıklama bulunmuyor."}
                                </Text>
                            </View>

                            {/* Aksiyon Butonları */}
                            <View style={styles.actionButtons}>
                                {selectedWorkout.status !== "completed" ? (
                                    <>
                                        <Pressable
                                            style={[
                                                styles.primaryButton,
                                                isProcessing && {
                                                    opacity: 0.7,
                                                },
                                            ]}
                                            onPress={handleMarkCompleted}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Ionicons
                                                        name="checkmark-circle"
                                                        size={22}
                                                        color="white"
                                                        style={{
                                                            marginRight: 8,
                                                        }}
                                                    />
                                                    <Text
                                                        style={
                                                            styles.primaryButtonText
                                                        }
                                                    >
                                                        Tamamlandı Olarak
                                                        İşaretle
                                                    </Text>
                                                </>
                                            )}
                                        </Pressable>

                                        <Pressable
                                            style={
                                                styles.secondaryButtonOutline
                                            }
                                            onPress={handleGoToDetail}
                                        >
                                            <Text
                                                style={
                                                    styles.secondaryButtonText
                                                }
                                            >
                                                Detayları İncele
                                            </Text>
                                            <Ionicons
                                                name="arrow-forward"
                                                size={18}
                                                color={COLORS.accent}
                                                style={{ marginLeft: 4 }}
                                            />
                                        </Pressable>
                                    </>
                                ) : (
                                    <Pressable
                                        style={styles.completedButton}
                                        onPress={handleGoToDetail}
                                    >
                                        <Ionicons
                                            name="trophy"
                                            size={22}
                                            color="white"
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text
                                            style={styles.completedButtonText}
                                        >
                                            Tamamlandı - Detayları Gör
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons
                                name="bed-outline"
                                size={60}
                                color={COLORS.subText}
                            />
                            <Text style={styles.emptyStateText}>
                                Antrenman Yok
                            </Text>
                            <Text style={styles.emptyStateSubText}>
                                Seçili günde planlanmış bir aktivite bulunmuyor.
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    section: { paddingHorizontal: 20, marginBottom: 20, marginTop: 15 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "600",
        marginBottom: 14,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    fullCalendarButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: COLORS.card,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    fullCalendarButtonText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: "600",
    },
    weekContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
    },
    dayCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    dayCardSelected: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    dayCardWithWorkout: { borderColor: "rgba(255, 107, 107, 0.3)" },
    dayText: {
        color: "#B0B0B0",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 4,
    },
    dayTextSelected: { color: "white" },
    dateText: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
    dateTextSelected: { color: "white" },
    workoutDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.accent,
        marginTop: 6,
    },
    workoutDotSelected: { backgroundColor: "white" },
    workoutCard: {
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
    workoutHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },
    iconCircle: {
        backgroundColor: COLORS.background,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    workoutHeaderText: { flex: 1 },
    workoutTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
    },
    workoutTime: { color: "#B0B0B0", fontSize: 14 },
    typeTag: {
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    typeTagText: { color: COLORS.accent, fontSize: 12, fontWeight: "600" },
    completedTag: {
        backgroundColor: "#4CAF50",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    completedTagText: { color: "white", fontSize: 11, fontWeight: "700" },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 15,
    },
    statBox: { flex: 1, alignItems: "center" },
    statLabel: {
        color: "#B0B0B0",
        fontSize: 12,
        marginTop: 6,
        marginBottom: 2,
    },
    statValue: { color: COLORS.text, fontSize: 16, fontWeight: "bold" },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: "rgba(176, 176, 176, 0.2)",
    },
    infoCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 18,
        marginBottom: 15,
    },
    infoCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    infoCardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
    infoCardText: { color: "#B0B0B0", fontSize: 14, lineHeight: 22 },
    actionButtons: { marginTop: 10, gap: 12 },
    primaryButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    primaryButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
    secondaryButtonOutline: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: "transparent",
    },
    secondaryButtonText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: "600",
    },
    completedButton: {
        backgroundColor: "#4CAF50",
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    completedButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
    emptyState: {
        alignItems: "center",
        padding: 40,
        backgroundColor: COLORS.card,
        borderRadius: 15,
    },
    emptyStateText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 10,
    },
    emptyStateSubText: {
        color: COLORS.subText,
        fontSize: 14,
        textAlign: "center",
        marginTop: 5,
    },
});
