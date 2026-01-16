import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
export interface ProgramSetupData {
  goal: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  mode: "duration" | "race_date";
  value: string; // Süre (hafta) veya Tarih (YYYY-MM-DD)
  start_date: string; // YENİ: Başlangıç Tarihi (YYYY-MM-DD)
}

interface ProgramSetupToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
}

// --- CONSTANTS ---
const GOAL_OPTIONS = [
  { id: "5k", label: "5K", icon: "flag" },
  { id: "10k", label: "10K", icon: "flag" },
  { id: "half_marathon", label: "Yarı Maraton", icon: "trophy" },
  { id: "marathon", label: "Maraton", icon: "medal" },
  { id: "weight_loss", label: "Kilo Verme", icon: "nutrition" },
  { id: "custom", label: "Kendin Yaz", icon: "create-outline" },
];

const DIFFICULTY_OPTIONS = [
  { id: "beginner", label: "Başlangıç", color: "#4CAF50" },
  { id: "intermediate", label: "Orta", color: "#FF9800" },
  { id: "advanced", label: "İleri", color: "#F44336" },
];

// Limitler
const MAX_WEEKS = 32;
const MAX_MONTHS_AHEAD = 8;
const MAX_START_DAYS = 14;

export const ProgramSetupTool = ({
  onSubmit,
  submitted,
}: ProgramSetupToolProps) => {
  const [isEditing, setIsEditing] = useState(true);

  // --- STATE ---

  // 1. Hedef
  const [goalChip, setGoalChip] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");

  // 2. Zorluk
  const [difficulty, setDifficulty] = useState<string>("intermediate");

  // 3. Süre / Bitiş (Target Date)
  const [timingMode, setTimingMode] = useState<"duration" | "race_date">(
    "duration",
  );
  const [weeks, setWeeks] = useState(8);

  const defaultTargetDate = new Date();
  defaultTargetDate.setDate(defaultTargetDate.getDate() + 84);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  // 4. Başlangıç Tarihi
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  // Input Ref
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (goalChip === "custom" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [goalChip]);

  // --- HANDLERS ---

  const handleChipSelect = (id: string) => {
    setGoalChip(id);
    if (id !== "custom") setCustomGoal("");
  };

  // TARGET DATE VALIDATION
  const validateTargetDate = (date: Date) => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(today.getMonth() + MAX_MONTHS_AHEAD);

    if (date > maxDate) {
      Alert.alert(
        "Süre Sınırı",
        "En fazla 8 aylık bir program oluşturabiliriz.",
      );
      setTargetDate(maxDate);
    } else {
      setTargetDate(date);
    }
  };

  // START DATE VALIDATION
  const getMaxStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_START_DAYS);
    return d;
  };

  const validateStartDate = (date: Date) => {
    const maxDate = getMaxStartDate();
    const dTime = new Date(date).setHours(0, 0, 0, 0);
    const maxTime = new Date(maxDate).setHours(0, 0, 0, 0);

    if (dTime > maxTime) {
      Alert.alert(
        "Başlangıç Tarihi",
        "En fazla 2 hafta sonrasını seçebilirsin. Hemen başlayalım! 🚀",
      );
      setStartDate(maxDate);
    } else {
      setStartDate(date);
    }
  };

  const setStartDateToTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    validateStartDate(d);
  };

  const setStartDateToNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const nextMonday = new Date(d.setDate(diff + 7));
    validateStartDate(nextMonday);
  };

  // DATE CHANGE HANDLERS
  const onTargetDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowTargetDatePicker(false);
    if (selectedDate) validateTargetDate(selectedDate);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowStartDatePicker(false);
    if (selectedDate) validateStartDate(selectedDate);
  };

  const incrementWeeks = () =>
    setWeeks((prev) => Math.min(prev + 1, MAX_WEEKS));
  const decrementWeeks = () => setWeeks((prev) => Math.max(prev - 1, 4));

  // SUBMIT
  const handleSubmit = () => {
    let finalGoal = "";
    if (goalChip === "custom") {
      finalGoal = customGoal.trim();
    } else {
      const option = GOAL_OPTIONS.find((g) => g.id === goalChip);
      finalGoal = option ? option.label : "";
    }

    if (!finalGoal) return;

    const formattedTargetDate = targetDate.toISOString().split("T")[0];
    const formattedStartDate = startDate.toISOString().split("T")[0];

    const payload: ProgramSetupData = {
      goal: finalGoal,
      difficulty: difficulty as any,
      mode: timingMode,
      value: timingMode === "duration" ? String(weeks) : formattedTargetDate,
      start_date: formattedStartDate,
    };

    setIsEditing(false);
    onSubmit(payload);
  };

  const getDisplayGoal = () => {
    if (goalChip === "custom") return customGoal || "Özel Hedef";
    return GOAL_OPTIONS.find((g) => g.id === goalChip)?.label;
  };

  // --- 1. SUBMITTED VIEW (ÖZET GÖRÜNÜM - GÜNCELLENDİ) ---
  if (submitted || !isEditing) {
    const diffLabel = DIFFICULTY_OPTIONS.find(
      (d) => d.id === difficulty,
    )?.label;

    // Tarih Formatları
    const targetDateDisplay = targetDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
    const startDateDisplay = startDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });

    // Mod'a göre metin belirleme
    const timingText =
      timingMode === "duration"
        ? `Süre: ${weeks} Haf`
        : `Bitiş: ${targetDateDisplay}`;

    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="rocket" size={16} color={COLORS.background} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedText}>
            {getDisplayGoal()} ({diffLabel})
          </Text>
          <Text style={styles.submittedSubText}>
            Başlangıç: {startDateDisplay} • {timingText}
          </Text>
        </View>
      </View>
    );
  }

  // --- 2. EDIT VIEW ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Program Detayları</Text>
        <Ionicons name="rocket-outline" size={16} color={COLORS.accent} />
      </View>

      {/* A. HEDEF SEÇİMİ */}
      <Text style={styles.label}>1. Hedefini Seç</Text>
      <View style={styles.gridContainer}>
        {GOAL_OPTIONS.map((item) => {
          const isActive = goalChip === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.gridItem, isActive && styles.gridItemActive]}
              onPress={() => handleChipSelect(item.id)}
            >
              <Ionicons
                name={item.icon as any}
                size={18}
                color={isActive ? "#000" : COLORS.accent}
                style={{ marginBottom: 4 }}
              />
              <Text
                style={[styles.gridText, isActive && styles.gridTextActive]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {goalChip === "custom" && (
        <View style={styles.customInputContainer}>
          <Ionicons
            name="create-outline"
            size={20}
            color={COLORS.accent}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={inputRef}
            style={styles.customInput}
            value={customGoal}
            onChangeText={setCustomGoal}
            placeholder="Hedefini buraya yaz..."
            placeholderTextColor="#666"
          />
        </View>
      )}

      {/* B. ZORLUK */}
      <Text style={styles.label}>2. Programın Zorluk Seviyesi</Text>
      <View style={styles.diffContainer}>
        {DIFFICULTY_OPTIONS.map((item) => {
          const isActive = difficulty === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.diffBtn,
                isActive && {
                  backgroundColor: item.color,
                  borderColor: item.color,
                },
              ]}
              onPress={() => setDifficulty(item.id)}
            >
              <Text
                style={[
                  styles.diffText,
                  isActive && { color: "white", fontWeight: "bold" },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* C. BAŞLANGIÇ TARİHİ */}
      <Text style={styles.label}>3. Ne zaman başlayalım?</Text>
      <View style={styles.dateContainer}>
        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={styles.quickDateBtn}
            onPress={setStartDateToTomorrow}
          >
            <Text style={styles.quickDateText}>Yarın</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickDateBtn}
            onPress={setStartDateToNextMonday}
          >
            <Text style={styles.quickDateText}>Haftaya Pzt</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.datePickerBtn}
          onPress={() => setShowStartDatePicker(true)}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={COLORS.accent}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.dateValue}>
              {startDate.toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>

        {/* Start Date Modal */}
        {Platform.OS === "ios" ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showStartDatePicker}
            onRequestClose={() => setShowStartDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(false)}
                  >
                    <Text style={styles.modalDoneBtn}>Tamam</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="spinner"
                  onChange={onStartDateChange}
                  minimumDate={new Date()}
                  maximumDate={getMaxStartDate()}
                  themeVariant="dark"
                  textColor="white"
                />
              </View>
            </View>
          </Modal>
        ) : (
          showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onStartDateChange}
              minimumDate={new Date()}
              maximumDate={getMaxStartDate()}
            />
          )
        )}
      </View>

      {/* D. SÜRE / BİTİŞ */}
      <Text style={styles.label}>4. Program Süresi</Text>
      <View style={styles.timingBox}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              timingMode === "duration" && styles.toggleBtnActive,
            ]}
            onPress={() => setTimingMode("duration")}
          >
            <Text
              style={[
                styles.toggleText,
                timingMode === "duration" && styles.toggleTextActive,
              ]}
            >
              Süre Bazlı
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              timingMode === "race_date" && styles.toggleBtnActive,
            ]}
            onPress={() => setTimingMode("race_date")}
          >
            <Text
              style={[
                styles.toggleText,
                timingMode === "race_date" && styles.toggleTextActive,
              ]}
            >
              Bitiş Tarihi
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timingContent}>
          {timingMode === "duration" ? (
            <View style={styles.durationControl}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={decrementWeeks}
              >
                <Ionicons name="remove" size={20} color="#CCC" />
              </TouchableOpacity>
              <View style={{ alignItems: "center", width: 90 }}>
                <Text style={styles.bigValue}>{weeks}</Text>
                <Text style={styles.smallLabel}>HAFTA</Text>
              </View>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={incrementWeeks}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: "100%" }}>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowTargetDatePicker(true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="flag-outline"
                    size={18}
                    color={COLORS.accent}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.datePickerText}>
                    {targetDate.toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              {/* Target Date Modal */}
              {Platform.OS === "ios" ? (
                <Modal
                  transparent={true}
                  animationType="slide"
                  visible={showTargetDatePicker}
                  onRequestClose={() => setShowTargetDatePicker(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity
                          onPress={() => setShowTargetDatePicker(false)}
                        >
                          <Text style={styles.modalDoneBtn}>Tamam</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={targetDate}
                        mode="date"
                        display="spinner"
                        onChange={onTargetDateChange}
                        minimumDate={new Date()}
                        maximumDate={
                          new Date(
                            new Date().setMonth(
                              new Date().getMonth() + MAX_MONTHS_AHEAD,
                            ),
                          )
                        }
                        themeVariant="dark"
                        textColor="white"
                      />
                    </View>
                  </View>
                </Modal>
              ) : (
                showTargetDatePicker && (
                  <DateTimePicker
                    value={targetDate}
                    mode="date"
                    display="default"
                    onChange={onTargetDateChange}
                    minimumDate={new Date()}
                    maximumDate={
                      new Date(
                        new Date().setMonth(
                          new Date().getMonth() + MAX_MONTHS_AHEAD,
                        ),
                      )
                    }
                  />
                )
              )}
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.btn,
          (!goalChip || (goalChip === "custom" && customGoal.length < 2)) &&
            styles.btnDisabled,
        ]}
        disabled={!goalChip || (goalChip === "custom" && customGoal.length < 2)}
        onPress={handleSubmit}
      >
        <Text style={styles.btnText}>Devam Et</Text>
        <Ionicons
          name="arrow-forward"
          size={16}
          color="#000"
          style={{ marginLeft: 5 }}
        />
      </TouchableOpacity>
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { width: "100%" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { color: "white", fontWeight: "700", fontSize: 14 },
  label: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 4,
  },

  // Grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  gridItem: {
    width: "31%",
    aspectRatio: 1.4,
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  gridItemActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  gridText: {
    color: "#AAA",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  gridTextActive: { color: "#000", fontWeight: "700" },

  // Input
  customInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginBottom: 15,
  },
  customInput: { flex: 1, paddingVertical: 12, color: "white", fontSize: 13 },

  // Difficulty
  diffContainer: { flexDirection: "row", gap: 8, marginBottom: 15 },
  diffBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#2C2C2C",
    alignItems: "center",
  },
  diffText: { color: "#AAA", fontSize: 12 },

  // New Date Section (Start Date)
  dateContainer: {
    backgroundColor: "#252525",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 15,
  },
  quickDateRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  quickDateBtn: {
    backgroundColor: "#333",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  quickDateText: { color: COLORS.accent, fontSize: 11, fontWeight: "600" },
  datePickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  dateValue: { color: "white", fontSize: 14, fontWeight: "600" },
  datePickerText: { color: "white", fontSize: 15, fontWeight: "600" },

  // Timing
  timingBox: {
    backgroundColor: "#252525",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 15,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#1F1F1F",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#2C2C2C" },
  toggleText: { color: "#666", fontSize: 12, fontWeight: "600" },
  toggleTextActive: { color: "white" },
  timingContent: { padding: 15, alignItems: "center" },
  durationControl: { flexDirection: "row", alignItems: "center", gap: 15 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  bigValue: { color: "white", fontSize: 28, fontWeight: "700" },
  smallLabel: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingHorizontal: 10,
  },
  modalHeader: {
    alignItems: "flex-end",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalDoneBtn: { color: COLORS.accent, fontSize: 16, fontWeight: "bold" },

  // Button
  btn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 5,
  },
  btnDisabled: { backgroundColor: "#333", opacity: 0.7 },
  btnText: { color: "#000", fontWeight: "700", fontSize: 14 },

  // Submitted
  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 10,
    gap: 10,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  submittedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  submittedText: { color: "#CCC", fontSize: 13, fontWeight: "500" },
  submittedSubText: {
    color: "#888",
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
});
