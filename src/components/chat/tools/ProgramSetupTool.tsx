import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
export interface ProgramSetupData {
  goal: string;
  mode: "duration" | "race_date";
  value: string; // Süre (hafta) veya Tarih (YYYY-MM-DD)
  start_date: string; // Başlangıç Tarihi (YYYY-MM-DD)
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

const MAX_WEEKS = 32;
const MAX_MONTHS_AHEAD = 8;
const MAX_START_DAYS = 14;

export const ProgramSetupTool = ({
  onSubmit,
  submitted,
}: ProgramSetupToolProps) => {
  const [isEditing, setIsEditing] = useState(true);

  // --- STATE ---
  const [goalChip, setGoalChip] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");

  const [timingMode, setTimingMode] = useState<"duration" | "race_date">(
    "duration",
  );
  const [weeks, setWeeks] = useState(8);

  const defaultTargetDate = new Date();
  defaultTargetDate.setDate(defaultTargetDate.getDate() + 84); // 12 Hafta
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [startDate, setStartDate] = useState(new Date());

  // Modal Yönetimi
  const [activeModal, setActiveModal] = useState<
    "start_date" | "target_date" | null
  >(null);

  // Input Ref (Custom Goal için)
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

  const getMaxStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_START_DAYS);
    return d;
  };

  const setStartDateToTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setStartDate(d);
  };

  const setStartDateToNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    setStartDate(new Date(d.setDate(diff + 7)));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setActiveModal(null); // Android'de picker kapanır
    }
    if (selectedDate) {
      if (activeModal === "start_date") setStartDate(selectedDate);
      if (activeModal === "target_date") setTargetDate(selectedDate);
    }
  };

  // Hafta Artır/Azalt
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

  // --- MODAL İÇERİĞİ RENDERER (Sadece Tarih için) ---
  const renderModalContent = () => {
    if (activeModal === "start_date" || activeModal === "target_date") {
      const maxTargetDate = new Date();
      maxTargetDate.setMonth(maxTargetDate.getMonth() + MAX_MONTHS_AHEAD);

      return (
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={activeModal === "start_date" ? startDate : targetDate}
            mode="date"
            display="spinner"
            onChange={onDateChange}
            minimumDate={new Date()}
            maximumDate={
              activeModal === "start_date" ? getMaxStartDate() : maxTargetDate
            }
            themeVariant="dark"
            textColor="white"
            style={{ height: 200, width: "100%" }}
          />
        </View>
      );
    }
    return null;
  };

  // --- 1. SUBMITTED VIEW ---
  if (submitted || !isEditing) {
    const targetDateDisplay = targetDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
    const startDateDisplay = startDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
    const timingText =
      timingMode === "duration"
        ? `${weeks} Hafta Sürecek`
        : `Bitiş: ${targetDateDisplay}`;

    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="rocket" size={16} color={COLORS.background} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedText}>{getDisplayGoal()}</Text>
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
                size={22}
                color={isActive ? "#000" : COLORS.accent}
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

      {/* B. BAŞLANGIÇ TARİHİ */}
      <Text style={styles.label}>2. Ne zaman başlayalım?</Text>
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
      <Pressable
        style={styles.pickerTriggerCard}
        onPress={() => setActiveModal("start_date")}
      >
        <Text style={styles.inputLabelCenter}>Başlangıç Tarihi</Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={COLORS.accent}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.pickerTriggerText}>
            {startDate.toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
      </Pressable>

      {/* C. SÜRE / BİTİŞ */}
      <Text style={styles.label}>3. Program Süresi</Text>
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
            // --- GERİ GETİRİLEN +/- BUTONLARI ---
            <View style={styles.durationControl}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={decrementWeeks}
              >
                <Ionicons name="remove" size={24} color="#CCC" />
              </TouchableOpacity>
              <View style={{ alignItems: "center", width: 90 }}>
                <Text style={styles.bigValue}>{weeks}</Text>
                <Text style={styles.smallLabel}>HAFTA</Text>
              </View>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={incrementWeeks}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <Pressable
              style={[
                styles.pickerTriggerCard,
                {
                  width: "100%",
                  borderWidth: 0,
                  backgroundColor: "transparent",
                  marginBottom: 0,
                },
              ]}
              onPress={() => setActiveModal("target_date")}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color={COLORS.accent}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.pickerTriggerText}>
                  {targetDate.toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Text style={styles.inputLabelCenter}>
                (Değiştirmek için tıkla)
              </Text>
            </Pressable>
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

      {/* --- CENTERED MODAL (Sadece Tarih İçin) --- */}
      {Platform.OS === "ios" && activeModal ? (
        <Modal visible={activeModal !== null} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setActiveModal(null)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardAvoiding}
            >
              <Pressable
                style={styles.modalCenteredContainer}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Pressable
                      onPress={() => setActiveModal(null)}
                      style={styles.headerBtn}
                    >
                      <Text style={styles.headerBtnTextCancel}>Kapat</Text>
                    </Pressable>
                    <Text style={styles.modalTitle}>Tarih Seçimi</Text>
                    <Pressable
                      onPress={() => setActiveModal(null)}
                      style={styles.headerBtn}
                    >
                      <Text style={styles.headerBtnTextSave}>Tamam</Text>
                    </Pressable>
                  </View>
                  <View style={styles.modalBody}>{renderModalContent()}</View>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      ) : (
        activeModal && (
          <DateTimePicker
            value={activeModal === "start_date" ? startDate : targetDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
            maximumDate={
              activeModal === "start_date"
                ? getMaxStartDate()
                : new Date(
                    new Date().setMonth(
                      new Date().getMonth() + MAX_MONTHS_AHEAD,
                    ),
                  )
            }
          />
        )
      )}
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
  // Başlık boşlukları dengelendi
  label: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },

  // --- GRID (Tam Ortalanmış & Dengeli Boşluk) ---
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  gridItem: {
    width: "31.5%",
    aspectRatio: 1.25,
    backgroundColor: "#252525",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3C",
    gap: 6, // İkon ve metin arası boşluk
  },
  gridItemActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  gridText: {
    color: "#AAA",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    // marginTop kaldırıldı, gap kullanılıyor
  },
  gridTextActive: { color: "#000", fontWeight: "700" },

  customInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginBottom: 12,
  },
  customInput: { flex: 1, paddingVertical: 14, color: "white", fontSize: 14 },

  quickDateRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  quickDateBtn: {
    backgroundColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  quickDateText: { color: COLORS.accent, fontSize: 12, fontWeight: "600" },

  pickerTriggerCard: {
    backgroundColor: "#252525",
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12, // Boşluk dengelendi
  },
  pickerTriggerText: { color: "white", fontSize: 20, fontWeight: "bold" },
  inputLabelCenter: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // --- TIMING BOX & DURATION CONTROL ---
  timingBox: {
    backgroundColor: "#252525",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#1F1F1F",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#2C2C2C" },
  toggleText: { color: "#666", fontSize: 12, fontWeight: "600" },
  toggleTextActive: { color: "white" },
  timingContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },

  // Yeni +/- Buton Stilleri
  durationControl: { flexDirection: "row", alignItems: "center", gap: 20 },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  bigValue: { color: "white", fontSize: 32, fontWeight: "700" },
  smallLabel: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalKeyboardAvoiding: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCenteredContainer: { width: "90%", maxWidth: 400 },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#242426",
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.white },
  headerBtn: { padding: 5 },
  headerBtnTextCancel: { color: COLORS.textDim, fontSize: 15 },
  headerBtnTextSave: { color: COLORS.accent, fontSize: 15, fontWeight: "bold" },
  modalBody: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#1C1C1E",
    minHeight: 150,
    justifyContent: "center",
  },

  pickerWrapper: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },

  btn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 5,
  },
  btnDisabled: { backgroundColor: "#333", opacity: 0.7 },
  btnText: { color: "#000", fontWeight: "700", fontSize: 15 },

  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    gap: 12,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  submittedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  submittedText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  submittedSubText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
});
