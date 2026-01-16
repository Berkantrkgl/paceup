import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
export interface AvailabilityData {
  frequency: number; // Haftada kaç gün
  days: string[]; // ["Mon", "Wed", "Fri"]
  long_run: string | null; // "Sun" veya null
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

export const AvailabilityTool = ({
  onSubmit,
  submitted,
}: AvailabilityToolProps) => {
  const [isEditing, setIsEditing] = useState(true);

  // --- STATE ---
  const [frequency, setFrequency] = useState(3); // Varsayılan 3 gün
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [longRunDay, setLongRunDay] = useState<string | null>(null);

  // Frequency değiştiğinde validation uyarısı vermemek için,
  // submit butonunu disable edeceğiz, ekstra bir side-effect gerekmez.

  // --- HANDLERS ---

  const incrementFreq = () => setFrequency((prev) => Math.min(prev + 1, 7));
  const decrementFreq = () => setFrequency((prev) => Math.max(prev - 1, 1));

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      // Çıkarıyorsa
      setSelectedDays((prev) => prev.filter((d) => d !== dayId));
      // Eğer çıkardığı gün, seçili uzun koşu günüyse, uzun koşuyu sıfırla
      if (longRunDay === dayId) setLongRunDay(null);
    } else {
      // Ekliyorsa
      setSelectedDays((prev) => [...prev, dayId]);
    }
  };

  const toggleLongRun = (dayId: string) => {
    // Zaten seçiliyse kaldır (toggle), değilse seç
    if (longRunDay === dayId) {
      setLongRunDay(null);
    } else {
      setLongRunDay(dayId);
    }
  };

  const handleSubmit = () => {
    // VALIDASYON: Seçilen gün sayısı, istenen sıklıktan az olamaz.
    if (selectedDays.length < frequency) {
      Alert.alert(
        "Eksik Gün Seçimi",
        `Haftada ${frequency} gün koşmak istiyorsun, ancak sadece ${selectedDays.length} gün seçtin. Lütfen ${frequency - selectedDays.length} gün daha işaretle.`,
      );
      return;
    }

    const payload: AvailabilityData = {
      frequency: frequency,
      days: selectedDays,
      long_run: longRunDay,
    };

    setIsEditing(false);
    onSubmit(payload);
  };

  // --- HELPERS ---
  const getLongRunLabel = () =>
    longRunDay
      ? ALL_DAYS.find((d) => d.id === longRunDay)?.label
      : "Fark Etmez";

  // --- 1. SUBMITTED VIEW ---
  if (submitted || !isEditing) {
    // Günleri sıralı göstermek için (Pzt, Sal...)
    const sortedDays = ALL_DAYS.filter((d) => selectedDays.includes(d.id)).map(
      (d) => d.label,
    );
    const daySummary =
      sortedDays.length === 7 ? "Her Gün" : sortedDays.join(", ");

    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="calendar" size={16} color={COLORS.background} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedText}>
            {frequency} Gün/Hafta • Uzun: {getLongRunLabel()}
          </Text>
          <Text style={styles.submittedSubText} numberOfLines={1}>
            Müsait: {daySummary}
          </Text>
        </View>
      </View>
    );
  }

  // --- 2. EDIT VIEW ---

  // Submit butonu ne zaman aktif?
  const isValid = selectedDays.length >= frequency;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Haftalık Program</Text>
        <Ionicons name="time-outline" size={16} color={COLORS.accent} />
      </View>

      {/* A. SIKLIK (FREQUENCY) */}
      <Text style={styles.label}>1. Haftada kaç gün koşmak istersin?</Text>
      <View style={styles.freqContainer}>
        <TouchableOpacity style={styles.circleBtn} onPress={decrementFreq}>
          <Ionicons name="remove" size={20} color="#CCC" />
        </TouchableOpacity>

        <View style={styles.freqValueBox}>
          <Text style={styles.bigValue}>{frequency}</Text>
          <Text style={styles.smallLabel}>GÜN</Text>
        </View>

        <TouchableOpacity style={styles.circleBtn} onPress={incrementFreq}>
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* B. MÜSAİT GÜNLER */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>2. Koşu için hangi günler müsaitsin?</Text>
        <Text style={[styles.hint, !isValid && { color: COLORS.accent }]}>
          (En az {frequency} gün)
        </Text>
      </View>

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

      {/* C. UZUN KOŞU (OPSİYONEL - SADECE SEÇİLEN GÜNLERDEN) */}
      {selectedDays.length > 0 && (
        <View style={styles.sectionFade}>
          <Text style={styles.label}>
            3. Uzun koşu için tercih ettiğin gün?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.longRunScroll}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            {/* "Fark Etmez" Seçeneği gibi davranması için seçim iptal edilebilir */}
            {selectedDays.map((dayId) => {
              const dayLabel = ALL_DAYS.find((d) => d.id === dayId)?.label;
              const isLongRun = longRunDay === dayId;
              return (
                <TouchableOpacity
                  key={dayId}
                  style={[styles.chip, isLongRun && styles.chipActive]}
                  onPress={() => toggleLongRun(dayId)}
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
          <Text style={styles.hintSmall}>
            * İsteğe bağlıdır. Seçmezsen AI en uygun günü belirler.
          </Text>
        </View>
      )}

      {/* SUBMIT BUTTON */}
      <TouchableOpacity
        style={[styles.btn, !isValid && styles.btnDisabled]}
        disabled={!isValid}
        onPress={handleSubmit}
      >
        <Text style={styles.btnText}>
          {isValid
            ? "Programı Tamamla 🏁"
            : `Lütfen ${frequency - selectedDays.length} gün daha seç`}
        </Text>
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
    marginBottom: 10,
    marginTop: 5,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
  },
  hint: { color: "#666", fontSize: 11, fontWeight: "500" },
  hintSmall: { color: "#555", fontSize: 10, marginTop: 8, fontStyle: "italic" },

  // A. Frequency
  freqContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252525",
    borderRadius: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#333",
    gap: 20,
    marginBottom: 10,
  },
  freqValueBox: { alignItems: "center", width: 60 },
  bigValue: { color: "white", fontSize: 28, fontWeight: "700" },
  smallLabel: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },

  // B. Days
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

  // C. Long Run Chips
  sectionFade: { marginTop: 5, marginBottom: 15 },
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
  submittedText: { color: "#CCC", fontSize: 13, fontWeight: "500" },
  submittedSubText: {
    color: "#888",
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
});
