import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
export interface AvailabilityData {
  days: string[]; // ["Mon", "Wed", "Fri"]
  long_run: string; // "Sun"
  start_date: string; // "2024-12-15"
}

interface AvailabilityToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
}

// --- CONSTANTS ---
const ALL_DAYS = [
  { id: "Mon", label: "Pzt" },
  { id: "Tue", label: "Sal" },
  { id: "Wed", label: "Çar" },
  { id: "Thu", label: "Per" },
  { id: "Fri", label: "Cum" },
  { id: "Sat", label: "Cmt" },
  { id: "Sun", label: "Paz" },
];

// Başlangıç Tarihi Limiti (Gün)
const MAX_START_DAYS = 14;

export const AvailabilityTool = ({
  onSubmit,
  submitted,
}: AvailabilityToolProps) => {
  const [isEditing, setIsEditing] = useState(true);

  // State
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [longRunDay, setLongRunDay] = useState<string | null>(null);

  // Date State (Varsayılan Bugün)
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- LOGIC ---

  // Maksimum Tarihi Hesapla (Bugün + 14 gün)
  const getMaxDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_START_DAYS);
    return d;
  };

  // Tarih Validasyonu
  const validateAndSetDate = (date: Date) => {
    const maxDate = getMaxDate();

    // Sadece gün bazlı karşılaştırma için saatleri sıfırlayalım (Opsiyonel ama temiz olur)
    const dTime = new Date(date).setHours(0, 0, 0, 0);
    const maxTime = new Date(maxDate).setHours(0, 0, 0, 0);

    if (dTime > maxTime) {
      Alert.alert(
        "Başlangıç Tarihi",
        "Programa başlamak için en fazla 2 hafta sonrasını seçebilirsin. Motivasyonunu kaybetmeden hemen başlayalım! 🚀"
      );
      setStartDate(maxDate);
    } else {
      setStartDate(date);
    }
  };

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays((prev) => prev.filter((d) => d !== dayId));
      if (longRunDay === dayId) setLongRunDay(null);
    } else {
      setSelectedDays((prev) => [...prev, dayId]);
    }
  };

  const setDateToTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    validateAndSetDate(d);
  };

  const setDateToNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const nextMonday = new Date(d.setDate(diff + 7));
    validateAndSetDate(nextMonday);
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
    if (selectedDays.length === 0 || !longRunDay) return;

    const formattedDate = startDate.toISOString().split("T")[0];

    const payload: AvailabilityData = {
      days: selectedDays,
      long_run: longRunDay,
      start_date: formattedDate,
    };

    setIsEditing(false);
    onSubmit(payload);
  };

  const getLongRunLabel = () =>
    ALL_DAYS.find((d) => d.id === longRunDay)?.label;

  // --- 1. SUBMITTED VIEW ---
  if (submitted || !isEditing) {
    const dateDisplay = startDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="calendar" size={16} color={COLORS.background} />
        </View>
        <Text style={styles.submittedText}>
          {selectedDays.length} Gün/Hafta • Uzun: {getLongRunLabel()} •
          Başlangıç: {dateDisplay}
        </Text>
      </View>
    );
  }

  // --- 2. EDIT VIEW ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Zamanlama ve Müsaitlik</Text>
        <Ionicons name="time-outline" size={16} color={COLORS.accent} />
      </View>

      {/* A. GÜN SEÇİMİ */}
      <Text style={styles.label}>1. Hangi günler koşabilirsin?</Text>
      <View style={styles.daysWrap}>
        {ALL_DAYS.map((d) => {
          const isSelected = selectedDays.includes(d.id);
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
              onPress={() => toggleDay(d.id)}
            >
              <Text
                style={[styles.dayText, isSelected && styles.dayTextActive]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* B. UZUN KOŞU */}
      {selectedDays.length > 0 && (
        <View style={styles.sectionFade}>
          <Text style={styles.label}>2. Uzun koşu günü hangisi olsun?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.longRunScroll}
          >
            {selectedDays.map((dayId) => {
              const dayLabel = ALL_DAYS.find((d) => d.id === dayId)?.label;
              const isLongRun = longRunDay === dayId;
              return (
                <TouchableOpacity
                  key={dayId}
                  style={[styles.chip, isLongRun && styles.chipActive]}
                  onPress={() => setLongRunDay(dayId)}
                >
                  <Ionicons
                    name={isLongRun ? "flame" : "radio-button-off"}
                    size={14}
                    color={isLongRun ? "#000" : COLORS.accent}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      isLongRun && styles.chipTextActive,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* C. BAŞLANGIÇ TARİHİ */}
      <Text style={[styles.label, { marginTop: 10 }]}>
        3. Ne zaman başlayalım?
      </Text>
      <View style={styles.dateContainer}>
        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={styles.quickDateBtn}
            onPress={setDateToTomorrow}
          >
            <Text style={styles.quickDateText}>Yarın</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickDateBtn}
            onPress={setDateToNextMonday}
          >
            <Text style={styles.quickDateText}>Haftaya Pzt</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.datePickerBtn}
          onPress={() => setShowDatePicker(true)}
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

        {/* --- DATE PICKER MODAL --- */}
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
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalDoneBtn}>Tamam</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  maximumDate={getMaxDate()} // LİMİT EKLENDİ (14 Gün)
                  themeVariant="dark"
                  textColor="white"
                />
              </View>
            </View>
          </Modal>
        ) : (
          showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
              maximumDate={getMaxDate()} // LİMİT EKLENDİ (14 Gün)
            />
          )
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.btn,
          (!longRunDay || selectedDays.length === 0) && styles.btnDisabled,
        ]}
        disabled={!longRunDay || selectedDays.length === 0}
        onPress={handleSubmit}
      >
        <Text style={styles.btnText}>Programı Oluştur 🚀</Text>
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
    marginBottom: 15,
  },
  title: { color: "white", fontWeight: "700", fontSize: 14 },
  label: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 5,
  },

  // A. Days
  daysWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2C2C2C",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  dayCircleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dayText: { color: "#AAA", fontSize: 11, fontWeight: "600" },
  dayTextActive: { color: "#000", fontWeight: "700" },

  // B. Long Run Chips
  sectionFade: { marginBottom: 15 },
  longRunScroll: { flexDirection: "row" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: "#AAA", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#000", fontWeight: "700" },

  // C. Date Section
  dateContainer: {
    backgroundColor: "#252525",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 15,
  },

  // Quick Actions
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

  // Manual Picker
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

  // Modal (iOS)
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

  // Main Button
  btn: {
    backgroundColor: COLORS.accent,
    alignItems: "center",
    paddingVertical: 14,
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
  submittedText: { color: "#CCC", fontSize: 13, fontWeight: "500", flex: 1 },
});
