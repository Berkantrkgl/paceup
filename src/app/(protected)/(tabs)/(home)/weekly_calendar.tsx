import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
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

const getLocalDateString = (date: Date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const DAYS_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS_TR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const getWorkoutTypeStyle = (type: string) => {
    switch (type) {
        case "tempo":    return { icon: "speedometer" as const,  color: COLORS.danger,    name: "Tempo Koşusu" };
        case "easy":     return { icon: "leaf" as const,          color: COLORS.success,   name: "Hafif Koşu" };
        case "interval": return { icon: "flash" as const,         color: COLORS.warning,   name: "İnterval" };
        case "long":     return { icon: "infinite" as const,      color: COLORS.info,      name: "Uzun Koşu" };
        case "rest":     return { icon: "moon" as const,          color: COLORS.textDim,   name: "Dinlenme" };
        default:         return { icon: "fitness" as const,       color: COLORS.secondary, name: "Koşu" };
    }
};

const getWeekMonday = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const formatWeekRange = (monday: Date): string => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mDay = monday.getDate();
    const mMonth = MONTHS_TR[monday.getMonth()];
    const sDay = sunday.getDate();
    const sMonth = MONTHS_TR[sunday.getMonth()];
    if (monday.getMonth() === sunday.getMonth()) return `${mDay}–${sDay} ${mMonth}`;
    return `${mDay} ${mMonth} – ${sDay} ${sMonth}`;
};

const paceFormat = (secs: number) =>
    `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

// --- Expand animasyonu ---
function ExpandableDetail({
    expanded,
    workout,
    isToday,
    isPast,
    onComplete,
    onUndo,
    isProcessing,
}: {
    expanded: boolean;
    workout: any;
    isToday: boolean;
    isPast: boolean;
    onComplete: () => void;
    onUndo: () => void;
    isProcessing: boolean;
}) {
    const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: expanded ? 1 : 0,
            duration: 240,
            useNativeDriver: false,
        }).start();
    }, [expanded]);

    const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });
    const opacity   = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

    const ts = getWorkoutTypeStyle(workout.workout_type);
    const isCompleted = workout.status === "completed";
    const canComplete = isToday || isPast;

    return (
        <Animated.View style={{ maxHeight, opacity, overflow: "hidden" }}>
            <View style={detailStyles.container}>
                {/* Meta kutular */}
                <View style={detailStyles.metaRow}>
                    <View style={detailStyles.metaBox}>
                        <Ionicons name="time-outline" size={16} color={COLORS.textDim} />
                        <Text style={detailStyles.metaVal}>{workout.planned_duration} dk</Text>
                        <Text style={detailStyles.metaLbl}>Süre</Text>
                    </View>
                    <View style={detailStyles.metaBox}>
                        <Ionicons name="location-outline" size={16} color={COLORS.textDim} />
                        <Text style={detailStyles.metaVal}>{workout.planned_distance} km</Text>
                        <Text style={detailStyles.metaLbl}>Mesafe</Text>
                    </View>
                    {workout.target_pace_seconds ? (
                        <View style={detailStyles.metaBox}>
                            <Ionicons name="speedometer-outline" size={16} color={COLORS.textDim} />
                            <Text style={detailStyles.metaVal}>{paceFormat(workout.target_pace_seconds)}</Text>
                            <Text style={detailStyles.metaLbl}>Pace</Text>
                        </View>
                    ) : null}
                </View>

                {/* Açıklama */}
                {workout.description ? (
                    <Text style={detailStyles.desc} numberOfLines={3}>{workout.description}</Text>
                ) : null}

                {/* Buton */}
                {isCompleted ? (
                    <Pressable style={detailStyles.undoBtn} onPress={onUndo} disabled={isProcessing}>
                        {isProcessing
                            ? <ActivityIndicator size="small" color={COLORS.success} />
                            : <>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                                <Text style={detailStyles.undoBtnText}>Tamamlandı · Geri Al</Text>
                              </>
                        }
                    </Pressable>
                ) : (
                    <Pressable
                        style={[detailStyles.completeBtn, { backgroundColor: canComplete ? ts.color : COLORS.cardVariant }]}
                        onPress={onComplete}
                        disabled={isProcessing || !canComplete}
                    >
                        {isProcessing
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <>
                                <Ionicons
                                    name={canComplete ? "checkmark-circle-outline" : "time-outline"}
                                    size={18} color="#fff"
                                />
                                <Text style={detailStyles.completeBtnText}>
                                    {canComplete ? "Antrenmanı Tamamla" : "Günü Bekleniyor"}
                                </Text>
                              </>
                        }
                    </Pressable>
                )}
            </View>
        </Animated.View>
    );
}

const detailStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        gap: 12,
    },
    metaRow: { flexDirection: "row", gap: 8 },
    metaBox: {
        flex: 1, alignItems: "center", gap: 3,
        backgroundColor: COLORS.background,
        borderRadius: 12, paddingVertical: 10,
        borderWidth: 1, borderColor: COLORS.cardBorder,
    },
    metaVal: { fontSize: 15, fontWeight: "800", color: COLORS.text },
    metaLbl: { fontSize: 10, fontWeight: "600", color: COLORS.textDim, textTransform: "uppercase" },
    desc: { fontSize: 14, color: COLORS.textDim, lineHeight: 20 },
    completeBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, paddingVertical: 14, borderRadius: 13,
    },
    completeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    undoBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, paddingVertical: 14, borderRadius: 13,
        borderWidth: 1, borderColor: COLORS.success,
    },
    undoBtnText: { color: COLORS.success, fontSize: 15, fontWeight: "700" },
});

// --- Satır ---
function WorkoutRow({
    workout,
    isExpanded,
    isToday,
    isPast,
    onPress,
    onComplete,
    onUndo,
    isProcessing,
}: {
    workout: any;
    isExpanded: boolean;
    isToday: boolean;
    isPast: boolean;
    onPress: () => void;
    onComplete: () => void;
    onUndo: () => void;
    isProcessing: boolean;
}) {
    const ts = getWorkoutTypeStyle(workout.workout_type);
    const isCompleted = workout.status === "completed";
    const isMissed = workout.status === "missed";

    const dateObj = (() => {
        const [y, m, d] = workout.scheduled_date.split("-").map(Number);
        return new Date(y, m - 1, d);
    })();
    const dayName = DAYS_TR[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = MONTHS_TR[dateObj.getMonth()];

    return (
        <View style={[rowStyles.wrapper, isExpanded && { borderColor: ts.color + "60" }]}>
            <Pressable style={rowStyles.header} onPress={onPress} android_ripple={{ color: COLORS.cardBorder }}>
                {/* Tarih */}
                <View style={rowStyles.dateCol}>
                    <Text style={[rowStyles.dayName, isToday && { color: COLORS.accent }]}>{dayName}</Text>
                    <Text style={[rowStyles.dayNum, isToday && { color: COLORS.accent }]}>{dayNum}</Text>
                    <Text style={[rowStyles.monthName, isToday && { color: COLORS.accent }]}>{monthName}</Text>
                </View>

                {/* Renk şeridi */}
                <View style={[rowStyles.colorBar, { backgroundColor: ts.color }]} />

                {/* Başlık + meta */}
                <View style={rowStyles.middle}>
                    <View style={rowStyles.titleRow}>
                        <View style={[rowStyles.typePill, { backgroundColor: ts.color + "22" }]}>
                            <Ionicons name={ts.icon} size={11} color={ts.color} />
                            <Text style={[rowStyles.typePillText, { color: ts.color }]}>
                                {ts.name.toUpperCase()}
                            </Text>
                        </View>
                        {isToday && (
                            <View style={[rowStyles.todayChip, { borderColor: ts.color }]}>
                                <Text style={[rowStyles.todayChipText, { color: ts.color }]}>Bugün</Text>
                            </View>
                        )}
                    </View>
                    <Text style={rowStyles.workoutName} numberOfLines={1}>{workout.title}</Text>
                    <Text style={rowStyles.metaLine}>
                        {workout.planned_duration} dk  ·  {workout.planned_distance} km
                        {workout.target_pace_seconds ? `  ·  ${paceFormat(workout.target_pace_seconds)} /km` : ""}
                    </Text>
                </View>

                {/* Durum */}
                <View style={rowStyles.statusCol}>
                    {isCompleted ? (
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                    ) : isMissed ? (
                        <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                    ) : (
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18} color={COLORS.textDim}
                        />
                    )}
                </View>
            </Pressable>

            <ExpandableDetail
                expanded={isExpanded}
                workout={workout}
                isToday={isToday}
                isPast={isPast}
                onComplete={onComplete}
                onUndo={onUndo}
                isProcessing={isProcessing}
            />
        </View>
    );
}

const rowStyles = StyleSheet.create({
    wrapper: {
        backgroundColor: COLORS.card,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 12,
    },
    dateCol: { width: 44, alignItems: "center" },
    dayName: { fontSize: 10, fontWeight: "700", color: COLORS.textDim, textTransform: "uppercase" },
    dayNum: { fontSize: 20, fontWeight: "800", color: COLORS.text, lineHeight: 24 },
    monthName: { fontSize: 10, fontWeight: "600", color: COLORS.textDim },
    colorBar: { width: 3, height: 44, borderRadius: 2 },
    middle: { flex: 1, gap: 3 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    typePill: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    },
    typePillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
    todayChip: {
        borderWidth: 1, borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    todayChipText: { fontSize: 9, fontWeight: "800" },
    workoutName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
    metaLine: { fontSize: 12, color: COLORS.textDim },
    statusCol: { width: 24, alignItems: "center" },
});

// --- Ana ekran ---
export default function HomeCalendarScreen() {
    const { token, refreshUserData } = useContext(AuthContext);
    const params = useLocalSearchParams();
    const { initialDate } = params;

    const todayStr = getLocalDateString();

    const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const scrollRef = useRef<ScrollView>(null);
    const rowOffsets = useRef<Record<string, number>>({});

    const weekMonday = useMemo(() => {
        const base = getWeekMonday(new Date());
        base.setDate(base.getDate() + weekOffset * 7);
        return base;
    }, [weekOffset]);

    const isCurrentWeek = weekOffset === 0;

    const weekDays = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekMonday);
            d.setDate(weekMonday.getDate() + i);
            return getLocalDateString(d);
        }),
    [weekMonday]);

    const weekWorkouts = useMemo(() =>
        allWorkouts
            .filter((w) => weekDays.includes(w.scheduled_date))
            .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [allWorkouts, weekDays]);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/workouts/?only_active=true`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    const workouts = Array.isArray(data) ? data : [];
                    setAllWorkouts(workouts);

                    if (initialDate) {
                        const dateStr = String(initialDate).split("T")[0];
                        // O tarihin haftasına git — timestamp yerine gün sayısı karşılaştır
                        const [ty, tm, td] = dateStr.split("-").map(Number);
                        const targetMonday = getWeekMonday(new Date(ty, tm - 1, td));
                        const todayMonday = getWeekMonday(new Date());
                        const dayDiff = Math.round(
                            (targetMonday.getTime() - todayMonday.getTime()) / (24 * 60 * 60 * 1000)
                        );
                        const diff = Math.round(dayDiff / 7);
                        setWeekOffset(diff);
                        setExpandedDate(dateStr);
                    } else {
                        // Bugün antrenman varsa otomatik aç
                        const todayWorkout = workouts.find((w: any) => w.scheduled_date === todayStr);
                        if (todayWorkout) setExpandedDate(todayStr);
                    }
                }
            } catch (e) {
                console.log("fetch error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    // Hafta değişince expanded'ı sıfırla
    useEffect(() => {
        setExpandedDate(null);
    }, [weekOffset]);

    // Açılan satıra scroll
    useEffect(() => {
        if (expandedDate && rowOffsets.current[expandedDate] !== undefined) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({
                    y: rowOffsets.current[expandedDate] - 20,
                    animated: true,
                });
            }, 100);
        }
    }, [expandedDate]);

    const handleToggle = (date: string) => {
        setExpandedDate((prev) => (prev === date ? null : date));
    };

    const handleComplete = (workout: any) => {
        const isPast = workout.scheduled_date < todayStr;
        const isToday = workout.scheduled_date === todayStr;
        if (!isPast && !isToday) {
            Alert.alert("Henüz Erken ⏳", "Gelecek tarihli bir antrenmanı tamamlayamazsın.");
            return;
        }
        Alert.alert("Antrenmanı Tamamla", "Tamamlandı olarak işaretlensin mi?", [
            { text: "İptal", style: "cancel" },
            {
                text: "Evet, Tamamla",
                onPress: async () => {
                    setProcessingId(workout.id);
                    try {
                        await fetch(`${API_URL}/workouts/${workout.id}/`, {
                            method: "PATCH",
                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "completed" }),
                        });
                        const postRes = await fetch(`${API_URL}/results/`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                workout: workout.id,
                                completed_at: new Date().toISOString(),
                                actual_duration: workout.planned_duration || 30,
                                actual_distance: workout.planned_distance || 5.0,
                                feeling: "normal",
                            }),
                        });
                        if (!postRes.ok) throw new Error();
                        const createdResult = await postRes.json();
                        await refreshUserData();
                        setAllWorkouts((prev) =>
                            prev.map((w) =>
                                w.id === workout.id ? { ...w, status: "completed", result: createdResult } : w
                            )
                        );
                        Alert.alert("Tebrikler! 🎉", "Antrenman kaydedildi.");
                    } catch {
                        Alert.alert("Hata", "İşlem başarısız oldu.");
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    const handleUndo = (workout: any) => {
        if (!workout.result) { Alert.alert("Hata", "Kayıt bulunamadı."); return; }
        Alert.alert("Geri Al", "Tamamlanmamış olarak işaretlensin mi?", [
            { text: "Vazgeç", style: "cancel" },
            {
                text: "Evet, Geri Al",
                style: "destructive",
                onPress: async () => {
                    setProcessingId(workout.id);
                    try {
                        await fetch(`${API_URL}/results/${workout.result.id}/`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        await fetch(`${API_URL}/workouts/${workout.id}/`, {
                            method: "PATCH",
                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "scheduled", is_completed: false }),
                        });
                        await refreshUserData();
                        setAllWorkouts((prev) =>
                            prev.map((w) =>
                                w.id === workout.id
                                    ? { ...w, status: workout.scheduled_date < todayStr ? "missed" : "scheduled", result: null }
                                    : w
                            )
                        );
                        Alert.alert("Tamam", "Durum geri alındı.");
                    } catch {
                        Alert.alert("Hata", "Geri alma başarısız.");
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Hafta nav */}
            <View style={styles.weekNav}>
                <Pressable style={styles.navBtn} onPress={() => setWeekOffset((o) => o - 1)}>
                    <Ionicons name="chevron-back" size={18} color={COLORS.text} />
                </Pressable>
                <View style={styles.weekTitleArea}>
                    <Text style={styles.weekTitle}>{formatWeekRange(weekMonday)}</Text>
                    {isCurrentWeek && (
                        <Text style={styles.currentWeekLabel}>Bu Hafta</Text>
                    )}
                </View>
                <Pressable style={styles.navBtn} onPress={() => setWeekOffset((o) => o + 1)}>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
                </Pressable>
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {weekWorkouts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={52} color={COLORS.textDim} />
                        <Text style={styles.emptyTitle}>Bu hafta antrenman yok</Text>
                        <Text style={styles.emptyDesc}>
                            {formatWeekRange(weekMonday)} haftasında planlanmış antrenman bulunmuyor.
                        </Text>
                    </View>
                ) : (
                    weekWorkouts.map((workout) => {
                        const isToday = workout.scheduled_date === todayStr;
                        const isPast  = workout.scheduled_date < todayStr;
                        return (
                            <View
                                key={workout.id}
                                onLayout={(e) => {
                                    rowOffsets.current[workout.scheduled_date] = e.nativeEvent.layout.y;
                                }}
                            >
                                <WorkoutRow
                                    workout={workout}
                                    isExpanded={expandedDate === workout.scheduled_date}
                                    isToday={isToday}
                                    isPast={isPast}
                                    onPress={() => handleToggle(workout.scheduled_date)}
                                    onComplete={() => handleComplete(workout)}
                                    onUndo={() => handleUndo(workout)}
                                    isProcessing={processingId === workout.id}
                                />
                            </View>
                        );
                    })
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    weekNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    navBtn: {
        padding: 8,
        borderRadius: 11,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    weekTitleArea: { alignItems: "center", gap: 5 },
    weekTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
    thisWeekBadge: {
        backgroundColor: COLORS.cardVariant,
        borderWidth: 1,
        borderColor: COLORS.accent,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },
    thisWeekText: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },
    currentWeekLabel: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },

    scroll: { flex: 1 },
    scrollContent: { paddingTop: 14, paddingHorizontal: 16 },

    emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 32, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
    emptyDesc: { fontSize: 14, color: COLORS.textDim, textAlign: "center", lineHeight: 20 },
});
