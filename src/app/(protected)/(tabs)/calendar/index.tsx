import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useContext, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Calendar } from "react-native-calendars";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

// API URL
const API_URL = "http://127.0.0.1:8000/api";

const CalendarScreen = () => {
    const { token } = useContext(AuthContext);
    const [viewMode, setViewMode] = useState("month");

    const today = new Date().toISOString().split("T")[0];
    const [selectedDate, setSelectedDate] = useState(today);

    const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
    const [workoutsMap, setWorkoutsMap] = useState<any>({});
    const [refreshing, setRefreshing] = useState(false);

    // --- VERİ ÇEKME ---
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
                    const date = w.scheduled_date;
                    if (!map[date]) map[date] = [];
                    map[date].push(w);
                });
                setWorkoutsMap(map);
            }
        } catch (error) {
            console.log("Calendar fetch error:", error);
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

    // --- NAVİGASYON (DÜZELTİLEN KISIM) ---
    const handleWorkoutPress = (workout: any) => {
        // detail_modal dosyasının tam yolunu buraya yazmalısın.
        // Eğer dosya yapın: app/(protected)/(tabs)/calendar/detail_modal.tsx ise:
        router.push({
            pathname: "/calendar/detail_modal",
            params: { workoutId: workout.id },
        });
    };

    // --- TAKVİM İŞARETLEME ---
    const markedDates: any = {};
    allWorkouts.forEach((w: any) => {
        const date = w.scheduled_date;
        const isCompleted = w.status === "completed";
        markedDates[date] = {
            marked: true,
            dotColor: isCompleted ? "#4CAF50" : COLORS.accent,
        };
    });
    markedDates[selectedDate] = {
        ...markedDates[selectedDate],
        selected: true,
        selectedColor: COLORS.accent,
        disableTouchEvent: true,
    };

    // --- HELPERLAR ---
    const getWorkoutTypeIcon = (type: string) => {
        switch (type) {
            case "tempo":
                return "speedometer-outline";
            case "easy":
                return "walk-outline";
            case "interval":
                return "flash-outline";
            case "long":
                return "trending-up-outline";
            case "rest":
                return "moon-outline";
            default:
                return "fitness-outline";
        }
    };

    const getWorkoutTypeColor = (type: string) => {
        switch (type) {
            case "tempo":
                return "#FF6B6B";
            case "easy":
                return "#4ECDC4";
            case "interval":
                return "#FFD93D";
            case "long":
                return "#A569BD";
            case "rest":
                return "#95A5A6";
            default:
                return COLORS.accent;
        }
    };

    const formatTime = (timeStr: string) =>
        timeStr ? timeStr.slice(0, 5) : "-";
    const formatDuration = (min: number) => (min ? `${min} dk` : "-");

    // Haftalık Görünüm
    const renderWeekView = () => {
        const current = new Date();
        const weekDays = [];
        for (let i = -3; i <= 3; i++) {
            const date = new Date(current);
            date.setDate(current.getDate() + i);
            const dateString = date.toISOString().split("T")[0];

            const dayWorkouts = workoutsMap[dateString] || [];

            weekDays.push({
                dateString: dateString,
                day: date.getDate(),
                dayName: date.toLocaleDateString("tr-TR", { weekday: "short" }),
                isToday: dateString === today,
                workouts: dayWorkouts,
                isSelected: dateString === selectedDate,
            });
        }

        return (
            <View style={styles.weekView}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {weekDays.map((day) => (
                        <Pressable
                            key={day.dateString}
                            style={[
                                styles.weekDayCard,
                                day.isToday && styles.weekDayCardToday,
                                day.isSelected && styles.weekDayCardSelected,
                            ]}
                            onPress={() => setSelectedDate(day.dateString)}
                        >
                            <Text
                                style={[
                                    styles.weekDayName,
                                    (day.isSelected || day.isToday) && {
                                        color: day.isSelected
                                            ? "white"
                                            : COLORS.accent,
                                    },
                                ]}
                            >
                                {day.dayName}
                            </Text>
                            <Text
                                style={[
                                    styles.weekDayNumber,
                                    (day.isSelected || day.isToday) && {
                                        color: day.isSelected
                                            ? "white"
                                            : COLORS.accent,
                                    },
                                ]}
                            >
                                {day.day}
                            </Text>
                            <View style={styles.weekDayDots}>
                                {day.workouts
                                    .slice(0, 3)
                                    .map((w: any, idx: number) => (
                                        <View
                                            key={idx}
                                            style={[
                                                styles.weekDayDot,
                                                {
                                                    backgroundColor:
                                                        getWorkoutTypeColor(
                                                            w.workout_type
                                                        ),
                                                },
                                            ]}
                                        />
                                    ))}
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const selectedDayWorkouts = workoutsMap[selectedDate] || [];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Antrenman Takvimi</Text>
                <View style={styles.viewToggle}>
                    <Pressable
                        style={[
                            styles.toggleButton,
                            viewMode === "week" && styles.toggleButtonActive,
                        ]}
                        onPress={() => setViewMode("week")}
                    >
                        <Ionicons
                            name="list-outline"
                            size={20}
                            color={viewMode === "week" ? "white" : COLORS.text}
                        />
                        <Text
                            style={[
                                styles.toggleButtonText,
                                viewMode === "week" &&
                                    styles.toggleButtonTextActive,
                            ]}
                        >
                            Hafta
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[
                            styles.toggleButton,
                            viewMode === "month" && styles.toggleButtonActive,
                        ]}
                        onPress={() => setViewMode("month")}
                    >
                        <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={viewMode === "month" ? "white" : COLORS.text}
                        />
                        <Text
                            style={[
                                styles.toggleButtonText,
                                viewMode === "month" &&
                                    styles.toggleButtonTextActive,
                            ]}
                        >
                            Ay
                        </Text>
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.accent}
                    />
                }
            >
                {viewMode === "month" ? (
                    <View style={styles.calendarContainer}>
                        <Calendar
                            current={selectedDate}
                            onDayPress={(day: any) =>
                                setSelectedDate(day.dateString)
                            }
                            markedDates={markedDates}
                            theme={{
                                calendarBackground: COLORS.card,
                                textSectionTitleColor: COLORS.text,
                                selectedDayBackgroundColor: COLORS.accent,
                                selectedDayTextColor: "white",
                                todayTextColor: COLORS.accent,
                                dayTextColor: COLORS.text,
                                textDisabledColor: "#666",
                                monthTextColor: COLORS.text,
                                textMonthFontSize: 18,
                                textMonthFontWeight: "bold",
                                arrowColor: COLORS.accent,
                                "stylesheet.calendar.header": {
                                    marginTop: 5,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                },
                            }}
                            style={styles.calendar}
                        />
                    </View>
                ) : (
                    renderWeekView()
                )}

                <View style={styles.workoutsSection}>
                    <Text style={styles.workoutsSectionTitle}>
                        {new Date(selectedDate).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                    </Text>

                    {selectedDayWorkouts.length > 0 ? (
                        selectedDayWorkouts.map((workout: any) => (
                            <Pressable
                                key={workout.id}
                                style={styles.workoutCard}
                                onPress={() => handleWorkoutPress(workout)}
                            >
                                <View
                                    style={[
                                        styles.workoutTypeIndicator,
                                        {
                                            backgroundColor:
                                                getWorkoutTypeColor(
                                                    workout.workout_type
                                                ),
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.workoutIconContainer,
                                        {
                                            backgroundColor: `${getWorkoutTypeColor(
                                                workout.workout_type
                                            )}20`,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={
                                            getWorkoutTypeIcon(
                                                workout.workout_type
                                            ) as any
                                        }
                                        size={24}
                                        color={getWorkoutTypeColor(
                                            workout.workout_type
                                        )}
                                    />
                                </View>
                                <View style={styles.workoutContent}>
                                    <View style={styles.workoutHeader}>
                                        <Text
                                            style={styles.workoutTitle}
                                            numberOfLines={1}
                                        >
                                            {workout.title}
                                        </Text>
                                        {workout.status === "completed" && (
                                            <View style={styles.completedBadge}>
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={12}
                                                    color="#4CAF50"
                                                />
                                                <Text
                                                    style={styles.completedText}
                                                >
                                                    Bitti
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.workoutDetails}>
                                        <View style={styles.workoutDetail}>
                                            <Ionicons
                                                name="time-outline"
                                                size={14}
                                                color="#B0B0B0"
                                            />
                                            <Text
                                                style={styles.workoutDetailText}
                                            >
                                                {formatTime(
                                                    workout.scheduled_time
                                                )}
                                            </Text>
                                        </View>
                                        <View style={styles.workoutDetail}>
                                            <Ionicons
                                                name="timer-outline"
                                                size={14}
                                                color="#B0B0B0"
                                            />
                                            <Text
                                                style={styles.workoutDetailText}
                                            >
                                                {formatDuration(
                                                    workout.planned_duration
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color="#B0B0B0"
                                />
                            </Pressable>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons
                                name="calendar-outline"
                                size={60}
                                color="#666"
                            />
                            <Text style={styles.emptyStateText}>
                                Bu günde antrenman yok
                            </Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default CalendarScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 15,
    },
    viewToggle: {
        flexDirection: "row",
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 10,
        gap: 6,
    },
    toggleButtonActive: { backgroundColor: COLORS.accent },
    toggleButtonText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
    toggleButtonTextActive: { color: "white" },
    scrollView: { flex: 1 },
    calendarContainer: {
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: 15,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    calendar: { borderRadius: 15 },
    weekView: { paddingVertical: 20, paddingLeft: 20 },
    weekDayCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 15,
        marginRight: 12,
        alignItems: "center",
        minWidth: 70,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    weekDayCardToday: { borderWidth: 2, borderColor: COLORS.accent },
    weekDayCardSelected: { backgroundColor: COLORS.accent },
    weekDayName: {
        color: "#B0B0B0",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 8,
    },
    weekDayNumber: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
    },
    weekDayDots: { flexDirection: "row", gap: 4 },
    weekDayDot: { width: 6, height: 6, borderRadius: 3 },
    workoutsSection: { paddingHorizontal: 20, marginTop: 25 },
    workoutsSectionTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 15,
    },
    workoutCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    workoutTypeIndicator: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 15,
        borderBottomLeftRadius: 15,
    },
    workoutIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
        marginRight: 12,
    },
    workoutContent: { flex: 1 },
    workoutHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    workoutTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "600",
        flex: 1,
        paddingRight: 5,
    },
    completedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(76, 175, 80, 0.15)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    completedText: { color: "#4CAF50", fontSize: 11, fontWeight: "600" },
    workoutDetails: { flexDirection: "row", gap: 15 },
    workoutDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
    workoutDetailText: { color: "#B0B0B0", fontSize: 13 },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        backgroundColor: COLORS.card,
        borderRadius: 15,
    },
    emptyStateText: {
        color: "#B0B0B0",
        fontSize: 16,
        marginTop: 15,
        marginBottom: 20,
    },
    addWorkoutButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.background,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    addWorkoutButtonText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: "600",
    },
});
