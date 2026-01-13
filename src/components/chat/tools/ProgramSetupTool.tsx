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
  value: string;
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
  // "Form Tutma" yerine "Kendin Yaz" geldi
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

export const ProgramSetupTool = ({
  onSubmit,
  submitted,
}: ProgramSetupToolProps) => {
  const [isEditing, setIsEditing] = useState(true);

  // State
  const [goalChip, setGoalChip] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");

  const [difficulty, setDifficulty] = useState<string>("intermediate");
  const [timingMode, setTimingMode] = useState<"duration" | "race_date">(
    "duration"
  );
  const [weeks, setWeeks] = useState(8);

  // Date Logic
  const defaultTargetDate = new Date();
  defaultTargetDate.setDate(defaultTargetDate.getDate() + 84); // +12 hafta default
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Input Ref (Otomatik odaklanma için)
  const inputRef = useRef<TextInput>(null);

  // "Kendin Yaz" seçilince input'a odaklan
  useEffect(() => {
    if (goalChip === "custom" && inputRef.current) {
      // Ufak bir gecikme ile klavye açılması daha stabil olur
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [goalChip]);

  // --- HANDLERS ---
  const handleChipSelect = (id: string) => {
    setGoalChip(id);
    if (id !== "custom") {
      setCustomGoal(""); // Başka bir şey seçilirse manual yazıyı temizle
    }
  };

  const validateAndSetDate = (date: Date) => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(today.getMonth() + MAX_MONTHS_AHEAD);

    if (date > maxDate) {
      Alert.alert(
        "Süre Sınırı",
        "En fazla 8 aylık bir program oluşturabiliriz."
      );
      setTargetDate(maxDate);
    } else {
      setTargetDate(date);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      validateAndSetDate(selectedDate);
    }
  };

  const handleSubmit = () => {
    // Eğer custom seçiliyse input'u al, değilse chip label'ını al
    let finalGoal = "";

    if (goalChip === "custom") {
      finalGoal = customGoal.trim();
    } else {
      const option = GOAL_OPTIONS.find((g) => g.id === goalChip);
      finalGoal = option ? option.label : "";
    }

    if (!finalGoal) return;

    const formattedDate = targetDate.toISOString().split("T")[0];

    const payload: ProgramSetupData = {
      goal: finalGoal,
      difficulty: difficulty as any,
      mode: timingMode,
      value: timingMode === "duration" ? String(weeks) : formattedDate,
    };

    setIsEditing(false);
    onSubmit(payload);
  };

  const incrementWeeks = () =>
    setWeeks((prev) => Math.min(prev + 1, MAX_WEEKS));
  const decrementWeeks = () => setWeeks((prev) => Math.max(prev - 1, 4));

  const getDisplayGoal = () => {
    if (goalChip === "custom") return customGoal || "Özel Hedef";
    return GOAL_OPTIONS.find((g) => g.id === goalChip)?.label;
  };

  // --- 1. SUBMITTED VIEW ---
  if (submitted || !isEditing) {
    const diffLabel = DIFFICULTY_OPTIONS.find(
      (d) => d.id === difficulty
    )?.label;
    const dateDisplay = targetDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="flag" size={16} color={COLORS.background} />
        </View>
        <Text style={styles.submittedText}>
          Hedef: {getDisplayGoal()} ({diffLabel}) •{" "}
          {timingMode === "duration" ? `${weeks} Hafta` : dateDisplay}
        </Text>
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

      {/* Manual Input (Sadece 'Kendin Yaz' seçiliyse açılır) */}
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
            placeholder="Hedefini buraya yaz (Örn: 50dk Altı 10K)..."
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

      {/* C. ZAMANLAMA */}
      <Text style={styles.label}>3. Programın Süresi/Bitiş Tarihi</Text>
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
                {/* HAFTA YAZISI BÜYÜTÜLDÜ */}
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
                onPress={() => setShowDatePicker(true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="calendar"
                    size={20}
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

              {Platform.OS === "ios" ? (
                <Modal
                  transparent={true}
                  animationType="slide"
                  visible={showDatePicker}
                  onRequestClose={() => setShowDatePicker(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.modalDoneBtn}>Tamam</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={targetDate}
                        mode="date"
                        display="spinner"
                        onChange={onDateChange}
                        minimumDate={new Date()}
                        maximumDate={
                          new Date(
                            new Date().setMonth(
                              new Date().getMonth() + MAX_MONTHS_AHEAD
                            )
                          )
                        }
                        themeVariant="dark"
                        textColor="white"
                      />
                    </View>
                  </View>
                </Modal>
              ) : (
                showDatePicker && (
                  <DateTimePicker
                    value={targetDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    minimumDate={new Date()}
                    maximumDate={
                      new Date(
                        new Date().setMonth(
                          new Date().getMonth() + MAX_MONTHS_AHEAD
                        )
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

  // HAFTA yazısı için yeni stil
  smallLabel: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  }, // Font büyütüldü

  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "space-between",
  },
  datePickerText: { color: "white", fontSize: 15, fontWeight: "600" },

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

  // Submitted (Tamamlandı Durumu)
  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 10,
    gap: 10,
    alignSelf: "flex-start",
    maxWidth: "100%", // 1. Ekleme: Genişliğin taşmasını önler
  },
  submittedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  submittedText: {
    color: "#CCC",
    fontSize: 13,
    fontWeight: "500",
    flex: 1, // 2. Ekleme: Metnin alt satıra kaymasını sağlar (Text Wrapping)
  },
});
