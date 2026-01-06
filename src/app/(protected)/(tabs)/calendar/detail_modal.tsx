import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

// --- HELPER: Date String (YYYY-MM-DD) ---
const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// --- HELPER: Theme Colors ---
const getWorkoutTypeStyle = (type: string) => {
    switch (type) {
        case "tempo":
            return {
                icon: "speedometer",
                color: COLORS.danger,
                name: "Tempo Koşusu",
                bgGradient: [COLORS.danger + "CC", COLORS.card],
            };
        case "easy":
            return {
                icon: "leaf",
                color: COLORS.success,
                name: "Hafif Koşu",
                bgGradient: [COLORS.success + "CC", COLORS.card],
            };
        case "interval":
            return {
                icon: "flash",
                color: COLORS.warning,
                name: "İnterval",
                bgGradient: [COLORS.warning + "CC", COLORS.card],
            };
        case "long":
            return {
                icon: "infinite",
                color: COLORS.info,
                name: "Uzun Koşu",
                bgGradient: [COLORS.info + "CC", COLORS.card],
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
                bgGradient: [COLORS.secondary + "CC", COLORS.card],
            };
    }
};

const getFeelingIcon = (feeling: string) => {
    switch (feeling) {
        case "excellent":
            return { icon: "star", color: "#FFD93D", text: "Mükemmel" };
        case "good":
            return { icon: "happy", color: COLORS.success, text: "İyi" };
        case "okay":
            return { icon: "thumbs-up", color: COLORS.secondary, text: "Orta" };
        case "hard":
            return { icon: "water", color: COLORS.danger, text: "Zor" };
        case "very_hard":
            return { icon: "skull", color: "#D32F2F", text: "Çok Zor" };
        default:
            return { icon: "remove-circle", color: COLORS.textDim, text: "-" };
    }
};

const DetailModal = () => {
    const { token, refreshUserData } = useContext(AuthContext);
    const params = useLocalSearchParams();
    const { workoutId } = params;

    // BUGÜNÜN TARİHİ
    const todayStr = getLocalDateString();

    const [workout, setWorkout] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- EDIT STATE ---
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState({
        title: "",
        workout_type: "easy",
        planned_duration: "",
        planned_distance: "",
        description: "",
    });

    const WORKOUT_TYPES = ["easy", "tempo", "interval", "long", "rest"];

    // --- FETCH DATA ---
    const fetchWorkoutDetail = async () => {
        if (!token || !workoutId) return;
        try {
            const response = await fetch(`${API_URL}/workouts/${workoutId}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setWorkout(data);
                // Initialize edit values
                setEditValues({
                    title: data.title,
                    workout_type: data.workout_type,
                    planned_duration: String(data.planned_duration || 0),
                    planned_distance: String(data.planned_distance || 0),
                    description: data.description || "",
                });
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

    // --- SAVE CHANGES (EDIT) ---
    const handleSaveChanges = async () => {
        setIsProcessing(true);
        try {
            const response = await fetch(`${API_URL}/workouts/${workoutId}/`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: editValues.title,
                    workout_type: editValues.workout_type,
                    planned_duration:
                        parseInt(editValues.planned_duration) || 0,
                    planned_distance:
                        parseFloat(editValues.planned_distance) || 0,
                    description: editValues.description,
                }),
            });

            if (response.ok) {
                const updatedData = await response.json();
                setWorkout(updatedData);
                setIsEditing(false);
                Alert.alert("Başarılı", "Plan güncellendi.");
            } else {
                Alert.alert("Hata", "Güncelleme başarısız.");
            }
        } catch (error) {
            Alert.alert("Hata", "Bağlantı hatası.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- COMPLETE WORKOUT ---
    const handleCompleteWorkout = () => {
        // 1. TARİH KONTROLÜ (Gelecek Tarih Engeli)
        if (workout.scheduled_date > todayStr) {
            Alert.alert(
                "Henüz Erken ⏳",
                "Gelecek tarihli bir antrenmanı şimdiden tamamlayamazsın. Günü geldiğinde tekrar dene."
            );
            return;
        }

        Alert.alert(
            "Antrenmanı Tamamla",
            "Tamamlandı olarak işaretlensin mi?",
            [
                { text: "İptal", style: "cancel" },
                {
                    text: "Tamamla",
                    onPress: async () => {
                        setIsProcessing(true);
                        try {
                            // 1. Status Update
                            await fetch(`${API_URL}/workouts/${workoutId}/`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "completed" }),
                            });

                            // 2. Create Result
                            const resultData = {
                                workout: workoutId,
                                actual_date: workout.scheduled_date,
                                actual_duration: workout.planned_duration || 30,
                                actual_distance:
                                    workout.planned_distance || 5.0,
                                feeling: "normal",
                            };

                            await fetch(`${API_URL}/results/`, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(resultData),
                            });

                            await refreshUserData();
                            fetchWorkoutDetail();
                            Alert.alert("Tebrikler!", "Antrenman tamamlandı.");
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

    // --- UNDO COMPLETION ---
    const handleMarkIncomplete = () => {
        if (!workout.result) {
            Alert.alert("Hata", "Sonuç kaydı bulunamadı.");
            return;
        }

        Alert.alert(
            "Geri Al",
            "Tamamlanmamış olarak işaretlensin mi? (Sonuç verisi silinecek)",
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

                            await fetch(`${API_URL}/workouts/${workoutId}/`, {
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
                            fetchWorkoutDetail();
                            Alert.alert("Bilgi", "Durum geri alındı.");
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

    // --- DELETE WORKOUT ---
    const handleDeleteWorkout = () => {
        Alert.alert("Sil", "Bu işlem geri alınamaz.", [
            { text: "İptal", style: "cancel" },
            {
                text: "Sil",
                style: "destructive",
                onPress: async () => {
                    try {
                        await fetch(`${API_URL}/workouts/${workoutId}/`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        await refreshUserData();
                        router.back();
                    } catch (error) {
                        Alert.alert("Hata", "Silinemedi.");
                    }
                },
            },
        ]);
    };

    // --- RENDER ---
    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!workout) return null;

    const currentType = isEditing
        ? editValues.workout_type
        : workout.workout_type;
    const theme = getWorkoutTypeStyle(currentType);

    const isCompleted = workout.status === "completed";
    const isMissed = workout.status === "missed";
    const result = workout.result;

    // Gelecek Tarih Kontrolü (UI için)
    const isFuture = workout.scheduled_date > todayStr;

    const dateObj = new Date(workout.scheduled_date);
    const formattedDate = dateObj.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
    });

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.container}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* --- HEADER --- */}
                <LinearGradient
                    colors={theme.bgGradient as any}
                    style={styles.headerCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.headerTopRow}>
                        <View
                            style={[
                                styles.iconCircle,
                                { backgroundColor: COLORS.background },
                            ]}
                        >
                            <Ionicons
                                name={theme.icon as any}
                                size={28}
                                color={theme.color}
                            />
                        </View>
                        <View style={styles.headerRight}>
                            <Text style={styles.dateText}>{formattedDate}</Text>
                            <Text
                                style={[
                                    styles.typeText,
                                    { color: theme.color },
                                ]}
                            >
                                {theme.name}
                            </Text>
                        </View>

                        {/* EDIT BUTTON */}
                        {!isCompleted && !isMissed && (
                            <Pressable
                                onPress={() => setIsEditing(!isEditing)}
                                style={styles.editButton}
                            >
                                <Ionicons
                                    name={isEditing ? "close" : "pencil"}
                                    size={20}
                                    color={COLORS.text}
                                />
                            </Pressable>
                        )}
                    </View>

                    {/* TITLE AREA */}
                    {isEditing ? (
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>
                                Antrenman Başlığı
                            </Text>
                            <TextInput
                                value={editValues.title}
                                onChangeText={(t) =>
                                    setEditValues({ ...editValues, title: t })
                                }
                                style={styles.textInputTitle}
                                placeholderTextColor={COLORS.textDim}
                            />
                        </View>
                    ) : (
                        <Text style={styles.workoutTitle}>{workout.title}</Text>
                    )}

                    {/* TYPE SELECTOR (Edit Mode) */}
                    {isEditing && (
                        <View style={styles.typeSelectorContainer}>
                            <Text style={styles.inputLabel}>
                                Antrenman Türü
                            </Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10 }}
                            >
                                {WORKOUT_TYPES.map((type) => {
                                    const tStyle = getWorkoutTypeStyle(type);
                                    const isSelected =
                                        editValues.workout_type === type;
                                    return (
                                        <Pressable
                                            key={type}
                                            onPress={() =>
                                                setEditValues({
                                                    ...editValues,
                                                    workout_type: type,
                                                })
                                            }
                                            style={[
                                                styles.typeOption,
                                                {
                                                    borderColor: tStyle.color,
                                                    backgroundColor: isSelected
                                                        ? tStyle.color
                                                        : "transparent",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name={tStyle.icon as any}
                                                size={18}
                                                color={
                                                    isSelected
                                                        ? "white"
                                                        : tStyle.color
                                                }
                                            />
                                            <Text
                                                style={[
                                                    styles.typeOptionText,
                                                    {
                                                        color: isSelected
                                                            ? "white"
                                                            : tStyle.color,
                                                    },
                                                ]}
                                            >
                                                {tStyle.name}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* STATUS BADGES (View Mode) */}
                    {!isEditing && (
                        <View style={styles.statusRow}>
                            {isCompleted && (
                                <View style={styles.statusBadge}>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={16}
                                        color={COLORS.success}
                                    />
                                    <Text
                                        style={[
                                            styles.statusText,
                                            { color: COLORS.success },
                                        ]}
                                    >
                                        TAMAMLANDI
                                    </Text>
                                </View>
                            )}
                            {isMissed && (
                                <View style={styles.statusBadge}>
                                    <Ionicons
                                        name="close-circle"
                                        size={16}
                                        color="#FF3B30"
                                    />
                                    <Text
                                        style={[
                                            styles.statusText,
                                            { color: "#FF3B30" },
                                        ]}
                                    >
                                        KAÇIRILDI
                                    </Text>
                                </View>
                            )}
                            {!isCompleted && !isMissed && (
                                <View style={styles.statusBadge}>
                                    <Ionicons
                                        name="time"
                                        size={16}
                                        color={COLORS.textDim}
                                    />
                                    <Text
                                        style={[
                                            styles.statusText,
                                            { color: COLORS.textDim },
                                        ]}
                                    >
                                        PLANLANDI
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </LinearGradient>

                {/* --- STATS --- */}
                {workout.workout_type !== "rest" && (
                    <View style={styles.statsRow}>
                        <View
                            style={[
                                styles.statBox,
                                isEditing && styles.statBoxEditing,
                            ]}
                        >
                            <Ionicons
                                name="timer-outline"
                                size={20}
                                color={COLORS.textDim}
                            />
                            {isEditing ? (
                                <TextInput
                                    value={editValues.planned_duration}
                                    onChangeText={(t) =>
                                        setEditValues({
                                            ...editValues,
                                            planned_duration: t,
                                        })
                                    }
                                    keyboardType="numeric"
                                    style={styles.statInput}
                                    placeholder="0"
                                    placeholderTextColor={COLORS.textDim}
                                />
                            ) : (
                                <Text style={styles.statValue}>
                                    {workout.planned_duration}
                                </Text>
                            )}
                            <Text style={styles.statLabel}>dk Plan</Text>
                        </View>

                        <View
                            style={[
                                styles.statBox,
                                isEditing && styles.statBoxEditing,
                            ]}
                        >
                            <Ionicons
                                name="location-outline"
                                size={20}
                                color={COLORS.textDim}
                            />
                            {isEditing ? (
                                <TextInput
                                    value={editValues.planned_distance}
                                    onChangeText={(t) =>
                                        setEditValues({
                                            ...editValues,
                                            planned_distance: t,
                                        })
                                    }
                                    keyboardType="numeric"
                                    style={styles.statInput}
                                    placeholder="0"
                                    placeholderTextColor={COLORS.textDim}
                                />
                            ) : (
                                <Text style={styles.statValue}>
                                    {workout.planned_distance}
                                </Text>
                            )}
                            <Text style={styles.statLabel}>km Plan</Text>
                        </View>

                        <View style={styles.statBox}>
                            <Ionicons
                                name="speedometer-outline"
                                size={20}
                                color={COLORS.textDim}
                            />
                            <Text style={styles.statValue}>
                                {isEditing ? "-" : workout.pace_display || "-"}
                            </Text>
                            <Text style={styles.statLabel}>Tempo</Text>
                        </View>
                    </View>
                )}

                {/* --- ACTUAL RESULTS --- */}
                {isCompleted && result && !isEditing && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>
                            Performans Raporu
                        </Text>
                        <View style={styles.resultCard}>
                            <View style={styles.resultRow}>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultLabel}>
                                        Gerçekleşen
                                    </Text>
                                    <Text style={styles.resultValueHighlight}>
                                        {result.actual_distance} km
                                    </Text>
                                </View>
                                <View style={styles.verticalLine} />
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultLabel}>Süre</Text>
                                    <Text style={styles.resultValue}>
                                        {result.actual_duration} dk
                                    </Text>
                                </View>
                                <View style={styles.verticalLine} />
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultLabel}>
                                        Kalori
                                    </Text>
                                    <Text style={styles.resultValue}>
                                        {result.calories_burned}
                                    </Text>
                                </View>
                            </View>
                            {result.feeling && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.feelingRow}>
                                        <Text style={styles.feelingLabel}>
                                            Hissiyat:
                                        </Text>
                                        <View style={styles.feelingBadge}>
                                            <Ionicons
                                                name={
                                                    getFeelingIcon(
                                                        result.feeling
                                                    ).icon as any
                                                }
                                                size={16}
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

                {/* --- DESCRIPTION --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Açıklama / Notlar</Text>
                    <View style={styles.descriptionCard}>
                        {isEditing ? (
                            <TextInput
                                value={editValues.description}
                                onChangeText={(t) =>
                                    setEditValues({
                                        ...editValues,
                                        description: t,
                                    })
                                }
                                style={styles.textInputDesc}
                                multiline
                                placeholderTextColor={COLORS.textDim}
                                placeholder="Notlarınızı buraya yazın..."
                            />
                        ) : (
                            <Text style={styles.descText}>
                                {workout.description || "Özel bir not yok."}
                            </Text>
                        )}
                    </View>
                </View>

                {/* --- ACTION BUTTONS --- */}
                <View style={styles.actionContainer}>
                    {isEditing ? (
                        // EDIT MODE BUTTONS
                        <View style={styles.editButtonsRow}>
                            <Pressable
                                style={[
                                    styles.secondaryButton,
                                    { borderColor: COLORS.textDim },
                                ]}
                                onPress={() => setIsEditing(false)}
                            >
                                <Text
                                    style={[
                                        styles.secondaryButtonText,
                                        { color: COLORS.textDim },
                                    ]}
                                >
                                    İptal
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.saveButton}
                                onPress={handleSaveChanges}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.saveButtonText}>
                                        Kaydet
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    ) : (
                        // VIEW MODE BUTTONS
                        <>
                            {/* COMPLETE BUTTON (Sadece tamamlanmamışsa) */}
                            {!isCompleted && (
                                <Pressable
                                    style={styles.shadowButton}
                                    onPress={handleCompleteWorkout}
                                    disabled={isProcessing} // Gelecek tarihli ise logic içinde kontrol var, ama buton aktif. İstersen disabled={isProcessing || isFuture} yapabilirsin ama alert vermek daha iyi.
                                >
                                    <LinearGradient
                                        // Eğer gelecek tarihli ise Gri, değilse Turuncu
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
                                        style={styles.gradientButton}
                                    >
                                        <Text style={styles.gradientButtonText}>
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
                                            size={24}
                                            color="white"
                                        />
                                    </LinearGradient>
                                </Pressable>
                            )}

                            {/* UNDO BUTTON (Sadece tamamlandıysa) */}
                            {isCompleted && (
                                <Pressable
                                    style={styles.undoButton}
                                    onPress={handleMarkIncomplete}
                                    disabled={isProcessing}
                                >
                                    <Ionicons
                                        name="refresh-circle-outline"
                                        size={24}
                                        color={COLORS.success}
                                    />
                                    <Text style={styles.undoButtonText}>
                                        Tamamlandı ✓ (Geri Al)
                                    </Text>
                                </Pressable>
                            )}

                            <Pressable
                                style={styles.deleteButton}
                                onPress={handleDeleteWorkout}
                                disabled={isProcessing}
                            >
                                <Ionicons
                                    name="trash-outline"
                                    size={20}
                                    color="#FF4D4D"
                                />
                                <Text style={styles.deleteButtonText}>
                                    Antrenmanı Sil
                                </Text>
                            </Pressable>
                        </>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default DetailModal;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { justifyContent: "center", alignItems: "center" },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingTop: 10 },

    // HEADER
    headerCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 15,
    },
    headerRight: { flex: 1 },
    dateText: {
        color: COLORS.textDim,
        fontSize: 12,
        textTransform: "uppercase",
        fontWeight: "600",
        marginBottom: 4,
    },
    typeText: { fontSize: 14, fontWeight: "bold", textTransform: "uppercase" },
    editButton: {
        padding: 8,
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 12,
    },

    workoutTitle: {
        color: COLORS.text,
        fontSize: 26,
        fontWeight: "800",
        marginBottom: 16,
    },

    // INPUTS
    inputContainer: { marginBottom: 15 },
    inputLabel: {
        color: COLORS.textDim,
        fontSize: 12,
        marginBottom: 5,
        fontWeight: "bold",
    },
    textInputTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.white,
        paddingVertical: 5,
    },
    textInputDesc: {
        color: COLORS.text,
        fontSize: 14,
        minHeight: 60,
        textAlignVertical: "top",
    },

    // TYPE SELECTOR
    typeSelectorContainer: { marginBottom: 20 },
    typeOption: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        gap: 6,
    },
    typeOptionText: { fontSize: 12, fontWeight: "700" },

    statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.2)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    statusText: { fontSize: 11, fontWeight: "700" },

    // STATS
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 25 },
    statBox: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statBoxEditing: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.cardVariant,
    },
    statValue: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "800",
        marginTop: 8,
    },
    statLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },
    statInput: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: "800",
        marginTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.textDim,
        textAlign: "center",
        width: "80%",
    },

    // RESULT
    sectionContainer: { marginBottom: 25 },
    sectionTitle: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "700",
        textTransform: "uppercase",
        marginBottom: 12,
        marginLeft: 4,
    },
    resultCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    resultRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    resultItem: { flex: 1, alignItems: "center" },
    verticalLine: { width: 1, height: 30, backgroundColor: COLORS.cardBorder },
    resultLabel: { color: COLORS.textDim, fontSize: 12, marginBottom: 6 },
    resultValue: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
    resultValueHighlight: {
        color: COLORS.success,
        fontSize: 18,
        fontWeight: "800",
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.cardBorder,
        marginVertical: 15,
    },
    feelingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    feelingLabel: { color: COLORS.textDim, fontSize: 14 },
    feelingBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: COLORS.background,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    feelingText: { fontSize: 14, fontWeight: "700" },

    // DESCRIPTION
    descriptionCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    descText: { color: COLORS.textDim, fontSize: 14, lineHeight: 20 },

    // ACTIONS
    actionContainer: { marginTop: 10, gap: 15 },
    shadowButton: {
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    gradientButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        borderRadius: 16,
        gap: 10,
    },
    gradientButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },

    // UNDO BUTTON
    undoButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.success,
        gap: 8,
        backgroundColor: COLORS.card,
    },
    undoButtonText: { color: COLORS.success, fontSize: 16, fontWeight: "bold" },

    deleteButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FF4D4D",
        gap: 8,
        backgroundColor: "transparent",
    },
    deleteButtonText: { color: "#FF4D4D", fontSize: 14, fontWeight: "600" },

    // EDIT BUTTONS
    editButtonsRow: { flexDirection: "row", gap: 15 },
    secondaryButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    secondaryButtonText: { fontSize: 16, fontWeight: "bold" },
    saveButton: {
        flex: 1,
        backgroundColor: COLORS.accent,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 16,
    },
    saveButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
