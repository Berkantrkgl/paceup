import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

const API_URL = "http://127.0.0.1:8000/api";

const DetailModal = () => {
    const { token } = useContext(AuthContext);
    const params = useLocalSearchParams();
    const { workoutId } = params;

    const [workout, setWorkout] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- DETAY VERİSİNİ ÇEK ---
    const fetchWorkoutDetail = async () => {
        if (!token || !workoutId) return;
        try {
            const response = await fetch(`${API_URL}/workouts/${workoutId}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setWorkout(data);
            } else {
                Alert.alert("Hata", "Antrenman detayları alınamadı.");
                router.back();
            }
        } catch (error) {
            console.log("Detail fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkoutDetail();
    }, [workoutId, token]);

    // --- ANTREMANI TAMAMLA ---
    const handleCompleteWorkout = () => {
        Alert.alert(
            "Antrenmanı Tamamla",
            "Tamamlandı olarak işaretlemek istiyor musunuz?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Tamamla",
                    onPress: async () => {
                        setIsProcessing(true);
                        try {
                            // 1. Status Güncelle
                            await fetch(`${API_URL}/workouts/${workoutId}/`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "completed" }),
                            });

                            // 2. Sonuç Oluştur (Otomatik veri ile)
                            const resultData = {
                                workout: workoutId,
                                actual_date: workout.scheduled_date,
                                actual_start_time:
                                    workout.scheduled_time || "08:00:00",
                                actual_duration: workout.planned_duration || 30,
                                actual_distance:
                                    workout.planned_distance || 5.0,
                                actual_pace: workout.target_pace || "6:00",
                                feeling: "good",
                                difficulty_rating: 3,
                                calories_burned: Math.round(
                                    (workout.planned_distance || 5) * 70
                                ),
                            };

                            const resResponse = await fetch(
                                `${API_URL}/results/`,
                                {
                                    method: "POST",
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(resultData),
                                }
                            );

                            if (resResponse.ok) {
                                Alert.alert(
                                    "Başarılı",
                                    "Antrenman tamamlandı! 🎉"
                                );
                                router.back();
                            } else {
                                Alert.alert("Hata", "Sonuç kaydedilemedi.");
                            }
                        } catch (error) {
                            Alert.alert("Hata", "İşlem başarısız.");
                        } finally {
                            setIsProcessing(false);
                        }
                    },
                },
            ]
        );
    };

    // --- SİLME ---
    const handleDeleteWorkout = () => {
        Alert.alert("Antrenmanı Sil", "Emin misiniz?", [
            { text: "İptal", style: "cancel" },
            {
                text: "Sil",
                style: "destructive",
                onPress: async () => {
                    setIsProcessing(true);
                    try {
                        const response = await fetch(
                            `${API_URL}/workouts/${workoutId}/`,
                            {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` },
                            }
                        );
                        if (response.ok) {
                            router.back();
                        } else {
                            Alert.alert("Hata", "Silinemedi.");
                        }
                    } catch (error) {
                        Alert.alert("Hata", "Sunucu hatası.");
                    } finally {
                        setIsProcessing(false);
                    }
                },
            },
        ]);
    };

    // --- HELPERLAR ---
    const getWorkoutTypeInfo = (type: string) => {
        switch (type) {
            case "tempo":
                return {
                    icon: "speedometer-outline",
                    color: "#FF6B6B",
                    name: "Tempo Koşusu",
                };
            case "easy":
                return {
                    icon: "walk-outline",
                    color: "#4ECDC4",
                    name: "Kolay Koşu",
                };
            case "interval":
                return {
                    icon: "flash-outline",
                    color: "#FFD93D",
                    name: "Interval",
                };
            case "long":
                return {
                    icon: "trending-up-outline",
                    color: "#A569BD",
                    name: "Uzun Koşu",
                };
            case "rest":
                return {
                    icon: "moon-outline",
                    color: "#95A5A6",
                    name: "Dinlenme",
                };
            default:
                return {
                    icon: "fitness-outline",
                    color: COLORS.accent,
                    name: "Antrenman",
                };
        }
    };

    const getFeelingIcon = (feeling: string) => {
        switch (feeling) {
            case "excellent":
                return {
                    icon: "star-outline",
                    color: "#FFD93D",
                    text: "Mükemmel",
                };
            case "good":
                return { icon: "happy-outline", color: "#4CAF50", text: "İyi" };
            case "okay":
                return {
                    icon: "happy-outline",
                    color: "#FFA726",
                    text: "Orta",
                };
            case "hard":
                return { icon: "sad-outline", color: "#FF6B6B", text: "Zor" };
            case "very_hard":
                return {
                    icon: "thunderstorm-outline",
                    color: "#D32F2F",
                    text: "Çok Zor",
                };
            default:
                return { icon: "remove-outline", color: "#B0B0B0", text: "-" };
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    if (isLoading) {
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

    if (!workout) return null;

    const typeInfo = getWorkoutTypeInfo(workout.workout_type);
    const result = workout.result;

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.headerCard}>
                    <View
                        style={[
                            styles.typeIconLarge,
                            { backgroundColor: `${typeInfo.color}20` },
                        ]}
                    >
                        <Ionicons
                            name={typeInfo.icon as any}
                            size={40}
                            color={typeInfo.color}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.headerTop}>
                            <View
                                style={[
                                    styles.typeBadge,
                                    { backgroundColor: `${typeInfo.color}20` },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.typeBadgeText,
                                        { color: typeInfo.color },
                                    ]}
                                >
                                    {typeInfo.name}
                                </Text>
                            </View>
                            {workout.status === "completed" && (
                                <View style={styles.completedBadge}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={18}
                                        color="#4CAF50"
                                    />
                                    <Text style={styles.completedText}>
                                        Tamamlandı
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.workoutTitle}>{workout.title}</Text>
                        <View style={styles.dateTimeInfo}>
                            <View style={styles.infoItem}>
                                <Ionicons
                                    name="calendar-outline"
                                    size={16}
                                    color="#B0B0B0"
                                />
                                <Text style={styles.infoText}>
                                    {formatDate(workout.scheduled_date)}
                                </Text>
                            </View>
                            {workout.scheduled_time && (
                                <View style={styles.infoItem}>
                                    <Ionicons
                                        name="time-outline"
                                        size={16}
                                        color="#B0B0B0"
                                    />
                                    <Text style={styles.infoText}>
                                        {workout.scheduled_time.slice(0, 5)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Plan Stats */}
                {workout.workout_type !== "rest" && (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Ionicons
                                name="timer-outline"
                                size={24}
                                color={COLORS.accent}
                            />
                            <Text style={styles.statLabel}>Plan Süre</Text>
                            <Text style={styles.statValue}>
                                {workout.planned_duration} dk
                            </Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons
                                name="navigate-outline"
                                size={24}
                                color={COLORS.accent}
                            />
                            <Text style={styles.statLabel}>Plan Mesafe</Text>
                            <Text style={styles.statValue}>
                                {workout.planned_distance} km
                            </Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons
                                name="speedometer-outline"
                                size={24}
                                color={COLORS.accent}
                            />
                            <Text style={styles.statLabel}>Hedef Tempo</Text>
                            <Text style={styles.statValue}>
                                {workout.target_pace || "-"}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Actual Data */}
                {result && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Gerçekleşen Veriler
                        </Text>
                        <View style={styles.actualDataCard}>
                            <View style={styles.actualDataRow}>
                                <View style={styles.actualDataItem}>
                                    <Ionicons
                                        name="navigate"
                                        size={20}
                                        color="#4CAF50"
                                    />
                                    <Text style={styles.actualDataLabel}>
                                        Mesafe
                                    </Text>
                                    <Text style={styles.actualDataValue}>
                                        {result.actual_distance} km
                                    </Text>
                                </View>
                                <View style={styles.actualDataItem}>
                                    <Ionicons
                                        name="speedometer"
                                        size={20}
                                        color="#4CAF50"
                                    />
                                    <Text style={styles.actualDataLabel}>
                                        Tempo
                                    </Text>
                                    <Text style={styles.actualDataValue}>
                                        {result.actual_pace}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.actualDataRow}>
                                <View style={styles.actualDataItem}>
                                    <Ionicons
                                        name="heart"
                                        size={20}
                                        color="#FF6B6B"
                                    />
                                    <Text style={styles.actualDataLabel}>
                                        Nabız
                                    </Text>
                                    <Text style={styles.actualDataValue}>
                                        {result.avg_heart_rate || "-"} bpm
                                    </Text>
                                </View>
                                <View style={styles.actualDataItem}>
                                    <Ionicons
                                        name="flame"
                                        size={20}
                                        color="#FFA726"
                                    />
                                    <Text style={styles.actualDataLabel}>
                                        Kalori
                                    </Text>
                                    <Text style={styles.actualDataValue}>
                                        {result.calories_burned || "-"} kcal
                                    </Text>
                                </View>
                            </View>
                            {result.feeling && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.feelingSection}>
                                        <Text style={styles.feelingLabel}>
                                            Nasıl Hissettim?
                                        </Text>
                                        <View style={styles.feelingBadge}>
                                            <Ionicons
                                                name={
                                                    getFeelingIcon(
                                                        result.feeling
                                                    ).icon as any
                                                }
                                                size={20}
                                                color={
                                                    getFeelingIcon(
                                                        result.feeling
                                                    ).color
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.feelingText,
                                                    {
                                                        color: getFeelingIcon(
                                                            result.feeling
                                                        ).color,
                                                    },
                                                ]}
                                            >
                                                {
                                                    getFeelingIcon(
                                                        result.feeling
                                                    ).text
                                                }
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* Plan Details */}
                {workout.workout_type !== "rest" && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Antrenman Planı</Text>
                        <View style={styles.planCard}>
                            <View style={styles.planItem}>
                                <View style={styles.planBullet}>
                                    <Text style={styles.planNumber}>1</Text>
                                </View>
                                <View style={styles.planContent}>
                                    <Text style={styles.planTitle}>Isınma</Text>
                                    <Text style={styles.planText}>
                                        {workout.warmup || "Hafif tempo koşu"}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.planItem}>
                                <View style={styles.planBullet}>
                                    <Text style={styles.planNumber}>2</Text>
                                </View>
                                <View style={styles.planContent}>
                                    <Text style={styles.planTitle}>
                                        Ana Antrenman
                                    </Text>
                                    <Text style={styles.planText}>
                                        {workout.main_workout ||
                                            workout.description}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.planItem}>
                                <View style={styles.planBullet}>
                                    <Text style={styles.planNumber}>3</Text>
                                </View>
                                <View style={styles.planContent}>
                                    <Text style={styles.planTitle}>Soğuma</Text>
                                    <Text style={styles.planText}>
                                        {workout.cooldown || "Yürüyüş ve germe"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                    {workout.status !== "completed" ? (
                        <>
                            <Pressable
                                style={[
                                    styles.primaryButton,
                                    isProcessing && { opacity: 0.7 },
                                ]}
                                onPress={handleCompleteWorkout}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={22}
                                            color="white"
                                        />
                                        <Text style={styles.primaryButtonText}>
                                            Tamamlandı Olarak İşaretle
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                            <View style={styles.secondaryButtons}>
                                <Pressable
                                    style={styles.deleteButton}
                                    onPress={handleDeleteWorkout}
                                >
                                    <Ionicons
                                        name="trash-outline"
                                        size={20}
                                        color="#FF6B6B"
                                    />
                                    <Text style={styles.deleteButtonText}>
                                        Sil
                                    </Text>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <Pressable
                            style={styles.deleteButton}
                            onPress={handleDeleteWorkout}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color="#FF6B6B"
                            />
                            <Text style={styles.deleteButtonText}>Sil</Text>
                        </Pressable>
                    )}
                </View>
                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default DetailModal;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20 },
    headerCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    typeIconLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        marginBottom: 15,
    },
    headerInfo: { alignItems: "center" },
    headerTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
    },
    typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    typeBadgeText: { fontSize: 12, fontWeight: "600" },
    completedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(76, 175, 80, 0.15)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    completedText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
    workoutTitle: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 15,
    },
    dateTimeInfo: { flexDirection: "row", gap: 20 },
    infoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    infoText: { color: "#B0B0B0", fontSize: 14 },
    statsGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 15,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    statLabel: {
        color: "#B0B0B0",
        fontSize: 11,
        marginTop: 8,
        marginBottom: 4,
        textAlign: "center",
    },
    statValue: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center",
    },
    section: { marginBottom: 20 },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },
    actualDataCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    actualDataRow: { flexDirection: "row", justifyContent: "space-around" },
    actualDataItem: { flex: 1, alignItems: "center" },
    actualDataLabel: {
        color: "#B0B0B0",
        fontSize: 12,
        marginTop: 6,
        marginBottom: 4,
    },
    actualDataValue: { color: COLORS.text, fontSize: 16, fontWeight: "bold" },
    feelingSection: { alignItems: "center" },
    feelingLabel: { color: "#B0B0B0", fontSize: 13, marginBottom: 10 },
    feelingBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.background,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    feelingText: { fontSize: 14, fontWeight: "600" },
    planCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    planItem: { flexDirection: "row", marginBottom: 20 },
    planBullet: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    planNumber: { color: "white", fontSize: 14, fontWeight: "bold" },
    planContent: { flex: 1 },
    planTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 4,
    },
    planText: { color: "#B0B0B0", fontSize: 14, lineHeight: 20 },
    notesCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 18,
        flexDirection: "row",
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    notesText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 22 },
    infoCard: {
        backgroundColor: COLORS.card,
        borderRadius: 15,
        padding: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    infoLabel: { color: "#B0B0B0", fontSize: 14, flex: 1 },
    infoValue: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
    divider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        marginVertical: 15,
    },
    actionSection: { marginTop: 10 },
    primaryButton: {
        backgroundColor: COLORS.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    primaryButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
    secondaryButtons: { flexDirection: "row", gap: 12 },
    secondaryButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.accent,
        gap: 6,
    },
    secondaryButtonText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
    deleteButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#FF6B6B",
        gap: 6,
    },
    deleteButtonText: { color: "#FF6B6B", fontSize: 14, fontWeight: "bold" },
});
