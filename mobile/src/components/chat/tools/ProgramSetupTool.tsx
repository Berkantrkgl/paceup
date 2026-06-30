import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface ProgramSetupData {
  goal: string;
  mode: "duration" | "race_date" | "ai_decide";
  value: string;
  start_date: string;
}

interface ProgramSetupToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
}

// Hedef tipleri kendi semantik renklerine sahip — tema-bağımsız sabitler.
const GOALS = [
  {
    id: "5k",
    label: "5 Kilometre",
    shortLabel: "5K",
    emoji: "🎯",
    color: "#FF6B6B",
  },
  {
    id: "10k",
    label: "10 Kilometre",
    shortLabel: "10K",
    emoji: "🏃",
    color: "#4ECDC4",
  },
  {
    id: "half_marathon",
    label: "Yarı Maraton",
    shortLabel: "21K",
    emoji: "🏅",
    color: "#FFD93D",
  },
  {
    id: "marathon",
    label: "Maraton",
    shortLabel: "42K",
    emoji: "🏆",
    color: "#A8E6CF",
  },
  {
    id: "weight_loss",
    label: "Kilo Verme",
    shortLabel: "Fit",
    emoji: "💪",
    color: "#95E1D3",
  },
  {
    id: "custom",
    label: "Özel Hedef",
    shortLabel: "Özel",
    emoji: "✨",
    color: "#F38181",
  },
];

const MAX_WEEKS = 24;
const MIN_WEEKS = 4;
const MAX_START_DAYS = 14;

export const ProgramSetupTool = ({
  onSubmit,
  submitted,
}: ProgramSetupToolProps) => {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [durationType, setDurationType] = useState<"weeks" | "date" | "auto">(
    "weeks",
  );
  const [weeks, setWeeks] = useState(8);
  const [targetDate, setTargetDate] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 84);
    return future;
  });

  const [showDatePicker, setShowDatePicker] = useState<
    "start" | "target" | null
  >(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (selectedGoal === "custom" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedGoal]);

  const getGoalLabel = () => {
    if (selectedGoal === "custom") return customGoal || "Özel Hedef";
    return GOALS.find((g) => g.id === selectedGoal)?.label || "";
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getMaxStartDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + MAX_START_DAYS);
    return maxDate;
  };

  const getMaxTargetDate = () => {
    const maxDate = new Date(startDate);
    maxDate.setDate(maxDate.getDate() + MAX_WEEKS * 7);
    return maxDate;
  };

  const canProceed = () => {
    if (step === 1)
      return (
        selectedGoal &&
        (selectedGoal !== "custom" || customGoal.trim().length > 2)
      );
    return true;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const formattedStart = startDate.toISOString().split("T")[0];
    const formattedTarget = targetDate.toISOString().split("T")[0];

    let finalValue = "";
    let finalMode: "duration" | "race_date" | "ai_decide" = "duration";

    if (durationType === "weeks") {
      finalValue = String(weeks);
      finalMode = "duration";
    } else if (durationType === "date") {
      finalValue = formattedTarget;
      finalMode = "race_date";
    } else {
      finalValue = "auto";
      finalMode = "ai_decide";
    }

    onSubmit({
      goal: getGoalLabel(),
      mode: finalMode,
      value: finalValue,
      start_date: formattedStart,
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(null);
    }
    if (selectedDate) {
      if (showDatePicker === "start") {
        setStartDate(selectedDate);
        if (durationType === "date") {
          const newTarget = new Date(selectedDate);
          newTarget.setDate(newTarget.getDate() + 84);
          setTargetDate(newTarget);
        }
      }
      if (showDatePicker === "target") setTargetDate(selectedDate);
    }
  };

  if (submitted) {
    const durationText =
      durationType === "weeks"
        ? `${weeks} Hafta`
        : durationType === "date"
          ? `${formatDate(targetDate)}'e kadar`
          : "Spark belirleyecek ✨";

    return (
      <View style={styles.submittedCard}>
        <View style={styles.submittedIcon}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedTitle}>{getGoalLabel()}</Text>
          <Text style={styles.submittedSubtitle}>
            {formatDate(startDate)} • {durationText}
          </Text>
        </View>
      </View>
    );
  }

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3].map((num) => (
        <View key={num} style={styles.stepWrapper}>
          <View
            style={[
              styles.stepDot,
              step >= num && styles.stepDotActive,
              step === num && styles.stepDotCurrent,
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                step >= num && styles.stepNumberActive,
              ]}
            >
              {num}
            </Text>
          </View>
          {num < 3 && (
            <View
              style={[styles.stepLine, step > num && styles.stepLineActive]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>🎯 Hedefini Seç</Text>
          <Text style={styles.stepSubtitle}>Ne için koşmak istiyorsun?</Text>

          <View style={styles.goalsList}>
            {GOALS.map((goal) => {
              const isSelected = selectedGoal === goal.id;
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalRow, isSelected && styles.goalRowActive]}
                  onPress={() => setSelectedGoal(goal.id)}
                >
                  <View style={styles.goalLeft}>
                    <View
                      style={[
                        styles.goalIconBox,
                        isSelected && { backgroundColor: goal.color + "30" },
                      ]}
                    >
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.goalTitle,
                          isSelected && styles.goalTitleActive,
                        ]}
                      >
                        {goal.label}
                      </Text>
                      <Text style={styles.goalSubtitle}>{goal.shortLabel}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterActive,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedGoal === "custom" && (
            <View style={styles.customInput}>
              <Ionicons name="create-outline" size={20} color={colors.accent} />
              <TextInput
                ref={inputRef}
                style={styles.customTextInput}
                value={customGoal}
                onChangeText={setCustomGoal}
                placeholder="Hedefini buraya yaz..."
                placeholderTextColor={colors.text.secondary}
                autoCapitalize="sentences"
              />
            </View>
          )}
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>📅 Başlangıç Tarihi</Text>
          <Text style={styles.stepSubtitle}>Ne zaman başlamak istersin?</Text>

          <View style={styles.quickDates}>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => setStartDate(new Date())}
            >
              <Text style={styles.quickDateText}>Bugün</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setStartDate(tomorrow);
              }}
            >
              <Text style={styles.quickDateText}>Yarın</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickDateBtn}
              onPress={() => {
                const nextMonday = new Date();
                const day = nextMonday.getDay();
                const diff = nextMonday.getDate() - day + (day === 0 ? 1 : 8);
                setStartDate(new Date(nextMonday.setDate(diff)));
              }}
            >
              <Text style={styles.quickDateText}>Gelecek Pzt</Text>
            </TouchableOpacity>
          </View>

          <Pressable
            style={styles.dateCard}
            onPress={() => setShowDatePicker("start")}
          >
            <Ionicons
              name="calendar"
              size={20}
              color={colors.accent}
              style={{ marginBottom: 6 }}
            />
            <Text style={styles.dateCardDate}>{formatDate(startDate)}</Text>
            <Text style={styles.dateCardLabel}>Tıklayarak değiştir</Text>
          </Pressable>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>⏱️ Program Süresi</Text>
          <Text style={styles.stepSubtitle}>Ne kadar sürmeli?</Text>

          <View style={styles.durationTabs}>
            <TouchableOpacity
              style={[
                styles.durationTab,
                durationType === "weeks" && styles.durationTabActive,
              ]}
              onPress={() => setDurationType("weeks")}
            >
              <Text
                style={[
                  styles.durationTabText,
                  durationType === "weeks" && styles.durationTabTextActive,
                ]}
              >
                Hafta Seç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.durationTab,
                durationType === "date" && styles.durationTabActive,
              ]}
              onPress={() => setDurationType("date")}
            >
              <Text
                style={[
                  styles.durationTabText,
                  durationType === "date" && styles.durationTabTextActive,
                ]}
              >
                Tarih Seç
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.durationTab,
                durationType === "auto" && styles.durationTabActive,
              ]}
              onPress={() => setDurationType("auto")}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={
                  durationType === "auto"
                    ? colors.accent
                    : colors.text.secondary
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.durationTabText,
                  durationType === "auto" && styles.durationTabTextActive,
                ]}
              >
                Otomatik
              </Text>
            </TouchableOpacity>
          </View>

          {durationType === "weeks" && (
            <View style={styles.weekSelector}>
              <TouchableOpacity
                style={styles.weekButton}
                onPress={() => setWeeks(Math.max(MIN_WEEKS, weeks - 1))}
              >
                <Ionicons name="remove" size={28} color={colors.text.secondary} />
              </TouchableOpacity>
              <View style={styles.weekDisplay}>
                <Text style={styles.weekNumber}>{weeks}</Text>
                <Text style={styles.weekLabel}>HAFTA</Text>
              </View>
              <TouchableOpacity
                style={styles.weekButton}
                onPress={() => setWeeks(Math.min(MAX_WEEKS, weeks + 1))}
              >
                <Ionicons name="add" size={28} color={colors.accent} />
              </TouchableOpacity>
            </View>
          )}

          {durationType === "date" && (
            <Pressable
              style={styles.dateCard}
              onPress={() => setShowDatePicker("target")}
            >
              <Ionicons
                name="flag"
                size={20}
                color={colors.accent}
                style={{ marginBottom: 6 }}
              />
              <Text style={styles.dateCardDate}>{formatDate(targetDate)}</Text>
              <Text style={styles.dateCardLabel}>Hedef tarih</Text>
            </Pressable>
          )}

          {durationType === "auto" && (
            <View style={styles.autoInfo}>
              <Ionicons
                name="sparkles-outline"
                size={32}
                color={colors.accent}
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.autoText}>
                Spark, hedefine ve profiline göre ideal program süresini
                belirleyecek!
              </Text>
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={colors.accent}
            />
            <Text style={styles.infoText}>
              Kısa süreli programlar daha yoğun antrenman gerektirir
            </Text>
          </View>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StepIndicator />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
            <Text style={styles.backButtonText}>Geri</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            step === 1 && { flex: 1 },
          ]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Text style={styles.nextButtonText}>
            {step === 3 ? "Tamamla" : "Devam"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {Platform.OS === "ios" && showDatePicker ? (
        <Modal visible transparent animationType="slide">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowDatePicker(null)}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.modalCancel}>Kapat</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Tarih Seç</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.modalDone}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={showDatePicker === "start" ? startDate : targetDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                minimumDate={new Date()}
                maximumDate={
                  showDatePicker === "start"
                    ? getMaxStartDate()
                    : getMaxTargetDate()
                }
                themeVariant={isDark ? "dark" : "light"}
                textColor={colors.text.primary}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={showDatePicker === "start" ? startDate : targetDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
            maximumDate={
              showDatePicker === "start"
                ? getMaxStartDate()
                : getMaxTargetDate()
            }
          />
        )
      )}
    </View>
  );
};

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: {
      width: "100%" as const,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      minHeight: 360,
    },
    stepContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 16,
    },
    stepWrapper: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 2,
      borderColor: c.border,
    },
    stepDotActive: {
      borderColor: c.accent,
    },
    stepDotCurrent: {
      backgroundColor: c.accent,
    },
    stepNumber: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: c.text.secondary,
    },
    stepNumberActive: {
      color: c.text.inverse,
    },
    stepLine: {
      width: 32,
      height: 2,
      backgroundColor: c.border,
      marginHorizontal: 6,
    },
    stepLineActive: {
      backgroundColor: c.accent,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    stepContent: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 4,
    },
    stepSubtitle: {
      fontSize: 13,
      color: c.text.secondary,
      marginBottom: 16,
    },

    // Liste Tarzı Hedef Seçimi
    goalsList: {
      gap: 8,
    },
    goalRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: c.surfaceVariant,
      borderRadius: 12,
      padding: 10,
      borderWidth: 2,
      borderColor: c.border,
    },
    goalRowActive: {
      borderColor: c.accent,
      backgroundColor: c.accent + "10",
    },
    goalLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    goalIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: c.surface,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    goalEmoji: {
      fontSize: 20,
    },
    goalTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: c.text.secondary,
      marginBottom: 1,
    },
    goalTitleActive: {
      color: c.text.primary,
    },
    goalSubtitle: {
      fontSize: 11,
      color: c.text.secondary,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    radioOuterActive: {
      borderColor: c.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.accent,
    },

    customInput: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      marginTop: 10,
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: c.accent,
    },
    customTextInput: {
      flex: 1,
      color: c.text.primary,
      fontSize: 14,
    },
    quickDates: {
      flexDirection: "row" as const,
      gap: 10,
      marginBottom: 12,
    },
    quickDateBtn: {
      flex: 1,
      backgroundColor: c.surfaceVariant,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
    },
    quickDateText: {
      color: c.accent,
      fontSize: 12,
      fontWeight: "600" as const,
    },
    dateCard: {
      backgroundColor: c.surfaceVariant,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
    },
    dateCardDate: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 2,
    },
    dateCardLabel: {
      fontSize: 11,
      color: c.text.secondary,
    },
    durationTabs: {
      flexDirection: "row" as const,
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
      padding: 3,
      marginBottom: 16,
    },
    durationTab: {
      flex: 1,
      flexDirection: "row" as const,
      paddingVertical: 8,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderRadius: 7,
    },
    durationTabActive: {
      backgroundColor: c.surface,
    },
    durationTabText: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: c.text.secondary,
    },
    durationTabTextActive: {
      color: c.accent,
    },
    weekSelector: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 20,
      paddingVertical: 16,
    },
    weekButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
    },
    weekDisplay: {
      alignItems: "center" as const,
      minWidth: 80,
    },
    weekNumber: {
      fontSize: 40,
      fontWeight: "700" as const,
      color: c.text.primary,
    },
    weekLabel: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: c.accent,
      letterSpacing: 2,
      marginTop: 2,
    },
    autoInfo: {
      alignItems: "center" as const,
      paddingVertical: 24,
    },
    autoText: {
      fontSize: 13,
      color: c.text.primary,
      textAlign: "center" as const,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
    infoBox: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.warning + "1A",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 8,
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.warning + "33",
    },
    infoText: {
      flex: 1,
      fontSize: 11,
      color: c.text.primary,
      lineHeight: 15,
    },
    footer: {
      flexDirection: "row" as const,
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    backButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: c.surfaceVariant,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: c.text.secondary,
    },
    nextButton: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: c.accent,
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextButtonText: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.inverse,
    },
    submittedCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surfaceVariant,
      padding: 12,
      borderRadius: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    submittedIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accent + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    submittedTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 2,
    },
    submittedSubtitle: {
      fontSize: 12,
      color: c.text.secondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end" as const,
    },
    modalContent: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: c.text.primary,
    },
    modalCancel: {
      fontSize: 15,
      color: c.text.secondary,
    },
    modalDone: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: c.accent,
    },
  } as const;
};
