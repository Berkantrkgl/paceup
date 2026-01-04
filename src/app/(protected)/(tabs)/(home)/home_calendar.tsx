import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
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
const ITEM_WIDTH = 60; // Her bir gün kutusunun genişliği (margin dahil)
const SPACING = (width - ITEM_WIDTH) / 2; // Ortalamak için kenar boşluğu

// --- TİPLER ---
type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export default function HomeCalendarScreen() {
    const { token, refreshUserData } = useContext(AuthContext);
    const flatListRef = useRef<FlatList>(null);
    const params = useLocalSearchParams();
    const { initialWorkoutId, initialDate } = params;

    const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(
        getLocalDateString()
    );
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- TAKVİM GÜNLERİ (6 AY) ---
    const calendarDays = useMemo(() => {
        const days = [];
        const range = 90;
        const baseDate = new Date(); // Referans her zaman bugün olsun

        for (let i = -range; i <= range; i++) {
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + i);
            const dateStr = getLocalDateString(date);

            days.push({
                fullDate: dateStr,
                dayName: date
                    .toLocaleDateString("tr-TR", { weekday: "short" })
                    .toUpperCase(),
                dateNum: date.getDate(),
                isToday: dateStr === getLocalDateString(),
            });
        }
        return days;
    }, []);

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

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const response = await fetch(`${API_URL}/workouts/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                setAllWorkouts(data);

                if (initialDate) {
                    // Gelen tarih YYYY-MM-DD formatında olmalı, saat varsa temizle
                    setSelectedDate(String(initialDate).split("T")[0]);
                } else if (initialWorkoutId) {
                    const target = data.find(
                        (w: any) => w.id === initialWorkoutId
                    );
                    if (target) setSelectedDate(target.scheduled_date);
                }
            } catch (error) {
                console.log("Fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    // --- ORTALAMA MANTIĞI (SCROLL TO CENTER) ---
    useEffect(() => {
        if (!loading && calendarDays.length > 0 && flatListRef.current) {
            const index = calendarDays.findIndex(
                (d) => d.fullDate === selectedDate
            );

            if (index !== -1) {
                // viewPosition yerine offset kullanıyoruz, çok daha stabil.
                // Formül: (Index * ItemWidth)
                // Padding (SPACING) sayesinde eleman tam ortaya gelir.
                flatListRef.current.scrollToOffset({
                    offset: index * ITEM_WIDTH,
                    animated: true,
                });
            }
        }
    }, [selectedDate, loading, calendarDays]);

    const onScrollToIndexFailed = (info: { index: number }) => {
        setTimeout(() => {
            flatListRef.current?.scrollToOffset({
                offset: info.index * ITEM_WIDTH,
                animated: true,
            });
        }, 500);
    };

    const changeDay = (direction: "prev" | "next") => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + (direction === "next" ? 1 : -1));
        setSelectedDate(getLocalDateString(current));
    };

    const goToToday = () => {
        setSelectedDate(getLocalDateString(new Date()));
    };

    const handleMarkCompleted = () => {
        const workout = allWorkouts.find(
            (w) => w.scheduled_date === selectedDate
        );
        if (!workout) return;

        // BUG FIX: Sadece tarih kısmını alıp karşılaştırıyoruz
        const todayStr = getLocalDateString();
        const workoutDateStr = workout.scheduled_date.split("T")[0];

        if (workoutDateStr > todayStr) {
            Alert.alert(
                "Henüz Erken ⏳",
                "Gelecek tarihli bir antrenmanı şimdiden tamamlayamazsın."
            );
            return;
        }

        Alert.alert(
            "Antrenmanı Tamamla",
            "Bu antrenmanı tamamlandı olarak işaretlemek istiyor musun?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Evet, Tamamla",
                    onPress: async () => {
                        setIsProcessing(true);
                        try {
                            await fetch(`${API_URL}/workouts/${workout.id}/`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "completed" }),
                            });

                            const resultData = {
                                workout: workout.id,
                                completed_at: new Date().toISOString(),
                                actual_duration: workout.planned_duration || 30,
                                actual_distance:
                                    workout.planned_distance || 5.0,
                                feeling: "normal",
                            };

                            const postRes = await fetch(`${API_URL}/results/`, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(resultData),
                            });

                            if (!postRes.ok) throw new Error("Result failed");
                            const createdResult = await postRes.json();

                            await refreshUserData();

                            const updatedList = allWorkouts.map((w) =>
                                w.id === workout.id
                                    ? {
                                          ...w,
                                          status: "completed",
                                          result: createdResult,
                                      }
                                    : w
                            );
                            setAllWorkouts(updatedList);
                            Alert.alert(
                                "Tebrikler! 🎉",
                                "Antrenman kaydedildi."
                            );
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

    const handleMarkIncomplete = () => {
        const workout = allWorkouts.find(
            (w) => w.scheduled_date === selectedDate
        );
        if (!workout || !workout.result) {
            Alert.alert("Hata", "Kayıt bulunamadı.");
            return;
        }

        Alert.alert(
            "Geri Al",
            "Bu antrenmanı tamamlanmamış olarak işaretlemek istiyor musun?",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Evet, Geri Al",
                    style: "destructive",
                    onPress: async () => {
                        setIsProcessing(true);
                        try {
                            await fetch(
                                `${API_URL}/results/${workout.result.id}/`,
                                {
                                    method: "DELETE",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                }
                            );

                            await fetch(`${API_URL}/workouts/${workout.id}/`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    status: "scheduled",
                                    is_completed: false,
                                }),
                            });

                            await refreshUserData();

                            const updatedList = allWorkouts.map((w) =>
                                w.id === workout.id
                                    ? {
                                          ...w,
                                          status: "scheduled",
                                          result: null,
                                      }
                                    : w
                            );
                            setAllWorkouts(updatedList);
                            Alert.alert("Tamam", "Durum geri alındı.");
                        } catch (error) {
                            Alert.alert("Hata", "Geri alma başarısız.");
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

    const selectedWorkout = allWorkouts.find(
        (w) => w.scheduled_date === selectedDate
    );
    const typeStyle = selectedWorkout
        ? getWorkoutTypeStyle(selectedWorkout.workout_type)
        : null;

    // Header Başlığı
    const displayDate = new Date(selectedDate);
    const monthName = displayDate.toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
    });
    const isTodaySelected = selectedDate === getLocalDateString();

    // Gelecek Tarih Kontrolü (UI için)
    const isFuture = selectedDate > getLocalDateString();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* --- CALENDAR STRIP --- */}
            <View style={styles.calendarSection}>
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => changeDay("prev")}
                        style={styles.arrowBtn}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={20}
                            color={COLORS.text}
                        />
                    </Pressable>

                    <View style={styles.titleContainer}>
                        <Text style={styles.monthTitle}>{monthName}</Text>
                        {!isTodaySelected && (
                            <Pressable
                                onPress={goToToday}
                                style={styles.todayBadge}
                            >
                                <Text style={styles.todayText}>Bugün</Text>
                            </Pressable>
                        )}
                    </View>

                    <Pressable
                        onPress={() => changeDay("next")}
                        style={styles.arrowBtn}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={COLORS.text}
                        />
                    </Pressable>
                </View>

                <View>
                    <FlatList
                        ref={flatListRef}
                        data={calendarDays}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.fullDate}
                        getItemLayout={(data, index) => ({
                            length: ITEM_WIDTH,
                            offset: ITEM_WIDTH * index,
                            index,
                        })}
                        onScrollToIndexFailed={onScrollToIndexFailed}
                        // İLK ve SON elemanı ortalamak için padding
                        contentContainerStyle={{ paddingHorizontal: SPACING }}
                        // Snap efekti için
                        snapToInterval={ITEM_WIDTH}
                        decelerationRate="fast"
                        renderItem={({ item }) => {
                            const isSelected = item.fullDate === selectedDate;
                            const hasWorkout = allWorkouts.some(
                                (w) => w.scheduled_date === item.fullDate
                            );
                            const workoutStatus = hasWorkout
                                ? allWorkouts.find(
                                      (w) => w.scheduled_date === item.fullDate
                                  )?.status
                                : null;

                            return (
                                <Pressable
                                    style={[
                                        styles.dayItem,
                                        isSelected && styles.dayItemSelected,
                                        !isSelected &&
                                            item.isToday &&
                                            styles.dayItemToday,
                                    ]}
                                    onPress={() =>
                                        setSelectedDate(item.fullDate)
                                    }
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

                                    <View
                                        style={[
                                            styles.dot,
                                            isSelected
                                                ? {
                                                      backgroundColor:
                                                          COLORS.white,
                                                  }
                                                : hasWorkout
                                                ? {
                                                      backgroundColor:
                                                          workoutStatus ===
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
                        }}
                    />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.detailSection}>
                    {selectedWorkout ? (
                        <View>
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

                            <View style={styles.descCard}>
                                <Text style={styles.descLabel}>Açıklama</Text>
                                <Text style={styles.descText}>
                                    {selectedWorkout.description ||
                                        "Bu antrenman için özel bir not bulunmuyor."}
                                </Text>
                            </View>

                            <View style={styles.actionContainer}>
                                {selectedWorkout.status !== "completed" ? (
                                    <Pressable
                                        style={styles.completeButton}
                                        onPress={handleMarkCompleted}
                                        disabled={isProcessing}
                                    >
                                        <LinearGradient
                                            colors={
                                                isFuture
                                                    ? [
                                                          COLORS.cardBorder,
                                                          COLORS.cardBorder,
                                                      ]
                                                    : [
                                                          COLORS.accent,
                                                          COLORS.secondary,
                                                      ]
                                            }
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
                                                        {isFuture
                                                            ? "Günü Bekleniyor"
                                                            : "Antrenmanı Tamamla"}
                                                    </Text>
                                                    <Ionicons
                                                        name={
                                                            isFuture
                                                                ? "time-outline"
                                                                : "checkmark-circle-outline"
                                                        }
                                                        size={22}
                                                        color="white"
                                                    />
                                                </>
                                            )}
                                        </LinearGradient>
                                    </Pressable>
                                ) : (
                                    // DÜZELTİLEN BUTON YAZISI
                                    <Pressable
                                        style={styles.undoButton}
                                        onPress={handleMarkIncomplete}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator
                                                color={COLORS.success}
                                            />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={24}
                                                    color={COLORS.success}
                                                />
                                                <Text
                                                    style={
                                                        styles.undoButtonText
                                                    }
                                                >
                                                    Tamamlandı ✓ (Geri Al)
                                                </Text>
                                            </>
                                        )}
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    ) : (
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
                                tarihinde antrenman yok.
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
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginBottom: 15,
        height: 40,
    },
    titleContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
    monthTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: COLORS.text,
        textTransform: "capitalize",
    },
    todayBadge: {
        backgroundColor: COLORS.cardVariant,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    todayText: { fontSize: 10, color: COLORS.accent, fontWeight: "700" },
    arrowBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    dayItem: {
        alignItems: "center",
        justifyContent: "center",
        width: ITEM_WIDTH,
        height: 75,
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
    dayItemToday: { borderWidth: 1, borderColor: COLORS.accent },
    dayName: {
        fontSize: 12,
        color: COLORS.textDim,
        marginBottom: 4,
        fontWeight: "600",
    },
    dayNumber: { fontSize: 16, fontWeight: "bold", color: COLORS.text },
    textWhite: { color: "white" },
    dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 6 },

    detailSection: { paddingHorizontal: 20 },
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
    typeText: { fontSize: 12, fontWeight: "bold", textTransform: "uppercase" },
    completedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    completedText: { color: COLORS.success, fontSize: 12, fontWeight: "bold" },
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
    metaItem: { alignItems: "center", flex: 1 },
    divider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.1)" },
    metaValue: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "bold",
        marginTop: 4,
    },
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
    descText: { fontSize: 15, color: COLORS.text, lineHeight: 24 },
    actionContainer: { marginBottom: 30 },
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
    btnText: { color: "white", fontSize: 18, fontWeight: "bold" },
    undoButton: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 18,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.success,
        gap: 10,
    },
    undoButtonText: { color: COLORS.success, fontSize: 16, fontWeight: "bold" },
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
    addWorkoutText: { color: COLORS.accent, fontWeight: "600" },
});
