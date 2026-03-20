import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
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

// --- CONSTANTS ---
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
          <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
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

          {/* YENİ TASARIM: Liste Tarzı Seçim */}
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
              <Ionicons name="create-outline" size={20} color={COLORS.accent} />
              <TextInput
                ref={inputRef}
                style={styles.customTextInput}
                value={customGoal}
                onChangeText={setCustomGoal}
                placeholder="Hedefini buraya yaz..."
                placeholderTextColor="#666"
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
              color={COLORS.accent}
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
                color={durationType === "auto" ? COLORS.accent : "#666"}
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
                <Ionicons name="remove" size={28} color="#AAA" />
              </TouchableOpacity>
              <View style={styles.weekDisplay}>
                <Text style={styles.weekNumber}>{weeks}</Text>
                <Text style={styles.weekLabel}>HAFTA</Text>
              </View>
              <TouchableOpacity
                style={styles.weekButton}
                onPress={() => setWeeks(Math.min(MAX_WEEKS, weeks + 1))}
              >
                <Ionicons name="add" size={28} color={COLORS.accent} />
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
                color={COLORS.accent}
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
                color={COLORS.accent}
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
              color={COLORS.accent}
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
            <Ionicons name="arrow-back" size={20} color="#AAA" />
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
          <Ionicons name="arrow-forward" size={20} color="#000" />
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
                themeVariant="dark"
                textColor="white"
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    minHeight: 360,
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3A3A3A",
  },
  stepDotActive: {
    borderColor: COLORS.accent,
  },
  stepDotCurrent: {
    backgroundColor: COLORS.accent,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  stepNumberActive: {
    color: "#000",
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: "#3A3A3A",
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: COLORS.accent,
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
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: "#999",
    marginBottom: 16,
  },

  // Liste Tarzı Hedef Seçimi
  goalsList: {
    gap: 8,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#252525",
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: "#2A2A2A",
  },
  goalRowActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + "10",
  },
  goalLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#1F1F1F",
    justifyContent: "center",
    alignItems: "center",
  },
  goalEmoji: {
    fontSize: 20,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CCC",
    marginBottom: 1,
  },
  goalTitleActive: {
    color: "#FFF",
  },
  goalSubtitle: {
    fontSize: 11,
    color: "#777",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterActive: {
    borderColor: COLORS.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },

  customInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    backgroundColor: "#252525",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  customTextInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
  },
  quickDates: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: "#252525",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  quickDateText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  dateCard: {
    backgroundColor: "#252525",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  dateCardDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  dateCardLabel: {
    fontSize: 11,
    color: "#777",
  },
  durationTabs: {
    flexDirection: "row",
    backgroundColor: "#252525",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  durationTab: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  durationTabActive: {
    backgroundColor: "#1A1A1A",
  },
  durationTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  durationTabTextActive: {
    color: COLORS.accent,
  },
  weekSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 16,
  },
  weekButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#252525",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  weekDisplay: {
    alignItems: "center",
    minWidth: 80,
  },
  weekNumber: {
    fontSize: 40,
    fontWeight: "700",
    color: "#FFF",
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
    letterSpacing: 2,
    marginTop: 2,
  },
  autoInfo: {
    alignItems: "center",
    paddingVertical: 24,
  },
  autoText: {
    fontSize: 13,
    color: "#CCC",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 165, 0, 0.2)",
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: "#DDD",
    lineHeight: 15,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#252525",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#AAA",
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  submittedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  submittedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  submittedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  submittedSubtitle: {
    fontSize: 12,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  modalCancel: {
    fontSize: 15,
    color: "#999",
  },
  modalDone: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.accent,
  },
});
