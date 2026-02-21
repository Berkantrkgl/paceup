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
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [longRunDay, setLongRunDay] = useState<string | null>(null);

  // --- HANDLERS ---
  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      // Listeden çıkar
      setSelectedDays((prev) => prev.filter((d) => d !== dayId));
      // Eğer çıkardığı gün, seçili uzun koşu günüyse, uzun koşuyu da sıfırla
      if (longRunDay === dayId) setLongRunDay(null);
    } else {
      // Listeye ekle
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
    // VALIDASYON: En az 1 gün seçilmiş olmalı
    if (selectedDays.length < 1) {
      Alert.alert("Eksik Seçim", "Lütfen koşmak istediğin günleri işaretle.");
      return;
    }

    // ARTIK SADECE GÜNLER VE UZUN KOŞU GİDİYOR
    const payload: AvailabilityData = {
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
            Haftada {selectedDays.length} Gün • Uzun: {getLongRunLabel()}
          </Text>
          <Text style={styles.submittedSubText} numberOfLines={1}>
            Müsait: {daySummary}
          </Text>
        </View>
      </View>
    );
  }

  // --- 2. EDIT VIEW ---

  // Submit butonu sadece en az 1 gün seçiliyse aktif olacak
  const isValid = selectedDays.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Haftalık Program</Text>
        <Ionicons name="time-outline" size={16} color={COLORS.accent} />
      </View>

      {/* A. MÜSAİT GÜNLER */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>1. Koşu için hangi günler müsaitsin?</Text>
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

      {/* B. UZUN KOŞU (OPSİYONEL - SADECE SEÇİLEN GÜNLERDEN) */}
      {selectedDays.length > 0 && (
        <View style={styles.sectionFade}>
          <Text style={styles.label}>
            2. Uzun koşu için tercih ettiğin gün?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.longRunScroll}
            contentContainerStyle={{ paddingRight: 20 }}
          >
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
            * İsteğe bağlıdır. Seçmezsen senin için en uygun günü ben
            belirlerim.
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
          {isValid ? "Seçimi Tamamla" : "En az 1 gün seçmelisin"}
        </Text>
        {isValid && (
          <Ionicons
            name="arrow-forward"
            size={16}
            color="#000"
            style={{ marginLeft: 5 }}
          />
        )}
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
    marginBottom: 5,
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
    marginBottom: 5,
    marginTop: 10,
  },
  hintSmall: { color: "#555", fontSize: 10, marginTop: 8, fontStyle: "italic" },

  // Days
  daysWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#252525",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  dayCircleActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dayText: { color: "#AAA", fontSize: 11, fontWeight: "600" },
  dayTextActive: { color: "#000", fontWeight: "700" },

  // Long Run Chips
  sectionFade: { marginTop: 5, marginBottom: 15 },
  longRunScroll: { flexDirection: "row" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: "#AAA", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#000", fontWeight: "700" },

  // Main Button
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

  // Submitted
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
