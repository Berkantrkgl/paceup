import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme, ThemeColors } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";

// --- DATE HELPER ---
const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// --- WORKOUT THEME ---
// Dark ve light için ayrı paletler — calendar/index.tsx ile aynı mantık.
type WorkoutType = "easy" | "tempo" | "interval" | "long";

const WORKOUT_META: Record<
  WorkoutType,
  { icon: string; name: string; colorDark: string; colorLight: string }
> = {
  tempo: {
    icon: "speedometer",
    name: "Tempo",
    colorDark: "#FF4501",
    colorLight: "#E23E00",
  },
  easy: {
    icon: "leaf",
    name: "Hafif",
    colorDark: "#4ECDC4",
    colorLight: "#0E9B8F",
  },
  interval: {
    icon: "flash",
    name: "İnterval",
    colorDark: "#FFD93D",
    colorLight: "#B8860B",
  },
  long: {
    icon: "infinite",
    name: "Uzun Koşu",
    colorDark: "#A569BD",
    colorLight: "#7B3F96",
  },
};

const getTheme = (type: string, c: ThemeColors, isDark: boolean) => {
  const meta = WORKOUT_META[type as WorkoutType];
  if (!meta) {
    return {
      icon: "fitness",
      color: c.accent,
      name: "Koşu",
    };
  }
  return {
    icon: meta.icon,
    name: meta.name,
    color: isDark ? meta.colorDark : meta.colorLight,
  };
};

const WorkoutDetail = () => {
  const { getValidToken, refreshUserData } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { workoutId } = useLocalSearchParams();
  const todayStr = getLocalDateString();

  // FEELINGS token'lardan beslenir → hook içinde.
  const FEELINGS: Record<
    string,
    { icon: string; color: string; text: string }
  > = {
    excellent: { icon: "star", color: colors.warning, text: "Mükemmel" },
    good: { icon: "happy", color: colors.success, text: "İyi" },
    okay: { icon: "thumbs-up", color: colors.secondary, text: "Orta" },
    hard: { icon: "water", color: colors.danger, text: "Zor" },
    very_hard: { icon: "skull", color: "#D32F2F", text: "Çok Zor" },
  };

  const [workout, setWorkout] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    title: "",
    workout_type: "easy",
    planned_duration: "",
    planned_distance: "",
    description: "",
  });

  // --- FETCH ---
  const fetchWorkout = async () => {
    const validToken = await getValidToken();
    if (!validToken || !workoutId) return;
    try {
      const res = await fetch(`${API_URL}/workouts/${workoutId}/`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkout(data);
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
    } catch {
      Alert.alert("Hata", "Bağlantı hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkout();
  }, [workoutId]);

  // --- SAVE EDIT ---
  const handleSave = async () => {
    setIsProcessing(true);
    const validToken = await getValidToken();
    try {
      const res = await fetch(`${API_URL}/workouts/${workoutId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editValues.title,
          workout_type: editValues.workout_type,
          planned_duration: parseInt(editValues.planned_duration) || 0,
          planned_distance: parseFloat(editValues.planned_distance) || 0,
          description: editValues.description,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkout(data);
        setIsEditing(false);
      } else {
        Alert.alert("Hata", "Güncelleme başarısız.");
      }
    } catch {
      Alert.alert("Hata", "Bağlantı hatası.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- COMPLETE ---
  const handleComplete = () => {
    if (workout.scheduled_date > todayStr) {
      Alert.alert(
        "Henüz Erken",
        "Gelecek tarihli bir antrenmanı şimdiden tamamlayamazsın.",
      );
      return;
    }

    Alert.alert("Antrenmanı Tamamla", "Tamamlandı olarak işaretlensin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Tamamla",
        onPress: async () => {
          setIsProcessing(true);
          const validToken = await getValidToken();
          try {
            await fetch(`${API_URL}/workouts/${workoutId}/`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${validToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "completed" }),
            });

            await fetch(`${API_URL}/results/`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${validToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                workout: workoutId,
                actual_date: workout.scheduled_date,
                actual_duration: workout.planned_duration || 30,
                actual_distance: workout.planned_distance || 5.0,
                feeling: "normal",
              }),
            });

            await refreshUserData();
            fetchWorkout();
          } catch {
            Alert.alert("Hata", "İşlem başarısız.");
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  // --- UNDO ---
  const handleUndo = () => {
    if (!workout.result) return;

    Alert.alert(
      "Geri Al",
      "Tamamlanmamış olarak işaretlensin mi? Sonuç verisi silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Geri Al",
          style: "destructive",
          onPress: async () => {
            setIsProcessing(true);
            const validToken = await getValidToken();
            try {
              await fetch(`${API_URL}/results/${workout.result.id}/`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${validToken}` },
              });
              await fetch(`${API_URL}/workouts/${workoutId}/`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${validToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  status: "scheduled",
                  is_completed: false,
                }),
              });
              await refreshUserData();
              fetchWorkout();
            } catch {
              Alert.alert("Hata", "Geri alma başarısız.");
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  // --- DELETE ---
  const handleDelete = () => {
    Alert.alert("Antrenmanı Sil", "Bu işlem geri alınamaz.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const validToken = await getValidToken();
          try {
            await fetch(`${API_URL}/workouts/${workoutId}/`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${validToken}` },
            });
            await refreshUserData();
            router.back();
          } catch {
            Alert.alert("Hata", "Silinemedi.");
          }
        },
      },
    ]);
  };

  // --- LOADING ---
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!workout) return null;

  const theme = getTheme(
    isEditing ? editValues.workout_type : workout.workout_type,
    colors,
    isDark,
  );
  const isCompleted = workout.status === "completed";
  const isMissed = workout.status === "missed";
  const isFuture = workout.scheduled_date > todayStr;
  const result = workout.result;

  const dateObj = new Date(workout.scheduled_date);
  const dayName = dateObj.toLocaleDateString("tr-TR", { weekday: "long" });
  const dayNum = dateObj.getDate();
  const monthYear = dateObj.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Background gradient — full bleed behind modal */}
      <LinearGradient
        colors={[
          theme.color + (isDark ? "30" : "70"),
          colors.background,
          colors.background,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========== MODAL HANDLE ========== */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* ========== HERO ========== */}
        <View style={styles.heroSection}>
          {/* Icon + Status + Edit */}
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIconCircle,
                { backgroundColor: theme.color + "20" },
              ]}
            >
              <Ionicons
                name={theme.icon as any}
                size={28}
                color={theme.color}
              />
            </View>

            <View style={styles.heroTopRight}>
              {isCompleted && (
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: colors.success + "20" },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.statusChipText, { color: colors.success }]}
                  >
                    Tamamlandı
                  </Text>
                </View>
              )}
              {isMissed && (
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: colors.danger + "20" },
                  ]}
                >
                  <Ionicons
                    name="close-circle"
                    size={14}
                    color={colors.danger}
                  />
                  <Text
                    style={[styles.statusChipText, { color: colors.danger }]}
                  >
                    Kaçırıldı
                  </Text>
                </View>
              )}
              {!isCompleted && !isMissed && (
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: theme.color + "20" },
                  ]}
                >
                  <Ionicons name="time" size={14} color={theme.color} />
                  <Text
                    style={[styles.statusChipText, { color: theme.color }]}
                  >
                    Planlandı
                  </Text>
                </View>
              )}

              {!isCompleted && !isMissed && !isEditing && (
                <Pressable
                  style={styles.editIconButton}
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons name="pencil" size={16} color={colors.text.secondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Type label */}
          <Text style={[styles.heroTypeLabel, { color: theme.color }]}>
            {theme.name}
          </Text>

          {/* Title */}
          {isEditing ? (
            <TextInput
              value={editValues.title}
              onChangeText={(t) =>
                setEditValues({ ...editValues, title: t })
              }
              style={styles.heroTitleInput}
              placeholderTextColor={colors.text.secondary}
            />
          ) : (
            <Text style={styles.heroTitle}>{workout.title}</Text>
          )}

          {/* Date */}
          <View style={styles.heroDateRow}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={colors.text.secondary}
            />
            <Text style={styles.heroDateText}>
              {dayNum} {monthYear}, {dayName}
            </Text>
          </View>
        </View>

        {/* ========== STATS ========== */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isEditing && styles.statCardEditing]}>
            <Ionicons name="timer-outline" size={20} color={theme.color} />
            {isEditing ? (
              <TextInput
                value={editValues.planned_duration}
                onChangeText={(t) =>
                  setEditValues({ ...editValues, planned_duration: t })
                }
                keyboardType="numeric"
                style={[styles.statValueInput, { color: theme.color }]}
                placeholder="0"
                placeholderTextColor={colors.text.secondary}
              />
            ) : (
              <Text style={[styles.statValue, { color: theme.color }]}>
                {workout.planned_duration || "-"}
              </Text>
            )}
            <Text style={styles.statLabel}>dakika</Text>
          </View>

          <View style={[styles.statCard, isEditing && styles.statCardEditing]}>
            <Ionicons name="navigate-outline" size={20} color={theme.color} />
            {isEditing ? (
              <TextInput
                value={editValues.planned_distance}
                onChangeText={(t) =>
                  setEditValues({ ...editValues, planned_distance: t })
                }
                keyboardType="numeric"
                style={[styles.statValueInput, { color: theme.color }]}
                placeholder="0"
                placeholderTextColor={colors.text.secondary}
              />
            ) : (
              <Text style={[styles.statValue, { color: theme.color }]}>
                {workout.planned_distance || "-"}
              </Text>
            )}
            <Text style={styles.statLabel}>km</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons
              name="speedometer-outline"
              size={20}
              color={theme.color}
            />
            <Text style={[styles.statValue, { color: theme.color }]}>
              {isEditing ? "-" : workout.pace_display || "-"}
            </Text>
            <Text style={styles.statLabel}>dk/km</Text>
          </View>
        </View>

        {/* ========== TYPE SELECTOR (edit) ========== */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Antrenman Türü</Text>
            <View style={styles.typeGrid}>
              {(Object.keys(WORKOUT_META) as WorkoutType[]).map((type) => {
                const meta = WORKOUT_META[type];
                const tColor = isDark ? meta.colorDark : meta.colorLight;
                const selected = editValues.workout_type === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() =>
                      setEditValues({ ...editValues, workout_type: type })
                    }
                    style={[
                      styles.typeChip,
                      {
                        borderColor: tColor,
                        backgroundColor: selected ? tColor : "transparent",
                      },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon as any}
                      size={16}
                      color={selected ? colors.text.inverse : tColor}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: selected ? colors.text.inverse : tColor },
                      ]}
                    >
                      {meta.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ========== PERFORMANCE ========== */}
        {isCompleted && result && !isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Performans</Text>
            <View style={styles.resultCard}>
              <View style={styles.resultGrid}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultItemValue}>
                    {result.actual_distance}
                  </Text>
                  <Text style={styles.resultItemLabel}>km</Text>
                </View>
                <View style={styles.resultDivider} />
                <View style={styles.resultItem}>
                  <Text style={styles.resultItemValue}>
                    {result.actual_duration}
                  </Text>
                  <Text style={styles.resultItemLabel}>dk</Text>
                </View>
                <View style={styles.resultDivider} />
                <View style={styles.resultItem}>
                  <Text style={styles.resultItemValue}>
                    {result.calories_burned || "-"}
                  </Text>
                  <Text style={styles.resultItemLabel}>kcal</Text>
                </View>
              </View>

              {result.feeling && FEELINGS[result.feeling] && (
                <View style={styles.feelingRow}>
                  <Ionicons
                    name={FEELINGS[result.feeling].icon as any}
                    size={16}
                    color={FEELINGS[result.feeling].color}
                  />
                  <Text
                    style={[
                      styles.feelingText,
                      { color: FEELINGS[result.feeling].color },
                    ]}
                  >
                    {FEELINGS[result.feeling].text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========== NOTES ========== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notlar</Text>
          <View style={styles.notesCard}>
            {isEditing ? (
              <TextInput
                value={editValues.description}
                onChangeText={(t) =>
                  setEditValues({ ...editValues, description: t })
                }
                style={styles.notesInput}
                multiline
                placeholder="Notlarını buraya yaz..."
                placeholderTextColor={colors.text.secondary}
              />
            ) : (
              <Text style={styles.notesText}>
                {workout.description || "Henüz not eklenmedi."}
              </Text>
            )}
          </View>
        </View>

        {/* ========== ACTIONS ========== */}
        <View style={styles.actions}>
          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setEditValues({
                    title: workout.title,
                    workout_type: workout.workout_type,
                    planned_duration: String(workout.planned_duration || 0),
                    planned_distance: String(workout.planned_distance || 0),
                    description: workout.description || "",
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={styles.saveButton}
                onPress={handleSave}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={colors.text.inverse} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <>
              {!isCompleted && (
                <Pressable
                  style={[
                    styles.primaryAction,
                    isFuture && styles.primaryActionDisabled,
                  ]}
                  onPress={handleComplete}
                  disabled={isProcessing}
                >
                  <Ionicons
                    name={
                      isFuture ? "time-outline" : "checkmark-circle-outline"
                    }
                    size={22}
                    color={colors.text.inverse}
                  />
                  <Text style={styles.primaryActionText}>
                    {isFuture ? "Günü Bekleniyor" : "Antrenmanı Tamamla"}
                  </Text>
                </Pressable>
              )}

              {isCompleted && (
                <Pressable
                  style={styles.undoAction}
                  onPress={handleUndo}
                  disabled={isProcessing}
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={20}
                    color={colors.success}
                  />
                  <Text style={styles.undoActionText}>Geri Al</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.deleteAction}
                onPress={handleDelete}
                disabled={isProcessing}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteActionText}>Antrenmanı Sil</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default WorkoutDetail;

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: { flex: 1, backgroundColor: c.background },
    centered: {
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 20 },

    // ===== HANDLE =====
    handleRow: {
      alignItems: "center" as const,
      paddingTop: 10,
      paddingBottom: 6,
    },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
    },

    // ===== HERO =====
    heroSection: {
      paddingTop: 12,
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    heroTopRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: 16,
    },
    heroTopRight: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    heroIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    statusChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "700" as const,
    },
    heroTypeLabel: {
      fontSize: 13,
      fontWeight: "700" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: "900" as const,
      color: c.text.primary,
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    heroTitleInput: {
      fontSize: 22,
      fontWeight: "800" as const,
      color: c.text.primary,
      borderBottomWidth: 1.5,
      borderBottomColor: c.accent,
      paddingVertical: 6,
      marginBottom: 10,
    },
    heroDateRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    heroDateText: {
      color: c.text.secondary,
      fontSize: 14,
      fontWeight: "500" as const,
    },
    editIconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    // ===== STATS =====
    statsRow: {
      flexDirection: "row" as const,
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
      gap: 6,
    },
    statCardEditing: {
      borderColor: c.accent + "60",
      backgroundColor: c.surfaceVariant,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "900" as const,
    },
    statValueInput: {
      fontSize: 22,
      fontWeight: "900" as const,
      textAlign: "center" as const,
      borderBottomWidth: 1,
      borderBottomColor: c.text.secondary,
      minWidth: 40,
      paddingVertical: 2,
    },
    statLabel: {
      color: c.text.secondary,
      fontSize: 11,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
    },

    // ===== SECTIONS =====
    section: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionLabel: {
      color: c.text.secondary,
      fontSize: 13,
      fontWeight: "700" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: 10,
      marginLeft: 4,
    },

    // ===== TYPE SELECTOR =====
    typeGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 10,
    },
    typeChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      gap: 6,
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: "700" as const,
    },

    // ===== RESULT =====
    resultCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.success + "40",
      gap: 16,
    },
    resultGrid: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    resultItem: {
      flex: 1,
      alignItems: "center" as const,
      gap: 2,
    },
    resultDivider: {
      width: 1,
      height: 28,
      backgroundColor: c.border,
    },
    resultItemValue: {
      color: c.text.primary,
      fontSize: 20,
      fontWeight: "800" as const,
    },
    resultItemLabel: {
      color: c.text.secondary,
      fontSize: 11,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
    },
    feelingRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 6,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    feelingText: {
      fontSize: 14,
      fontWeight: "700" as const,
    },

    // ===== NOTES =====
    notesCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: c.border,
    },
    notesText: {
      color: c.text.secondary,
      fontSize: 14,
      lineHeight: 22,
    },
    notesInput: {
      color: c.text.primary,
      fontSize: 14,
      lineHeight: 22,
      minHeight: 80,
      textAlignVertical: "top" as const,
    },

    // ===== ACTIONS =====
    actions: {
      paddingHorizontal: 20,
      gap: 12,
      marginTop: 4,
    },
    primaryAction: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 14,
      gap: 8,
    },
    primaryActionDisabled: {
      backgroundColor: c.border,
    },
    primaryActionText: {
      color: c.text.inverse,
      fontSize: 16,
      fontWeight: "700" as const,
    },
    undoAction: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.success + "50",
      backgroundColor: c.surface,
      gap: 8,
    },
    undoActionText: {
      color: c.success,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    deleteAction: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 6,
    },
    deleteActionText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: "600" as const,
    },

    // ===== EDIT ACTIONS =====
    editActions: {
      flexDirection: "row" as const,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelButtonText: {
      color: c.text.secondary,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    saveButton: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    saveButtonText: {
      color: c.text.inverse,
      fontSize: 15,
      fontWeight: "700" as const,
    },
  } as const;
};
