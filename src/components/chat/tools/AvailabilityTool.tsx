import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// --- TYPES ---
export interface AvailabilityData {
  days: string[];
  long_run: string | null;
}

interface AvailabilityToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
}

// --- CONSTANTS ---
const ALL_DAYS = [
  { id: "Mon", label: "Pazartesi", short: "Pzt", index: 0 },
  { id: "Tue", label: "Salı", short: "Sal", index: 1 },
  { id: "Wed", label: "Çarşamba", short: "Çar", index: 2 },
  { id: "Thu", label: "Perşembe", short: "Per", index: 3 },
  { id: "Fri", label: "Cuma", short: "Cum", index: 4 },
  { id: "Sat", label: "Cumartesi", short: "Cmt", index: 5 },
  { id: "Sun", label: "Pazar", short: "Paz", index: 6 },
];

export const AvailabilityTool = ({
  onSubmit,
  submitted,
}: AvailabilityToolProps) => {
  const { user } = useContext(AuthContext);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [longRunDay, setLongRunDay] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Kullanıcı verilerinden günleri yükle
  useEffect(() => {
    if (
      !initialized &&
      user?.preferred_running_days &&
      Array.isArray(user.preferred_running_days)
    ) {
      // Backend'den gelen index'leri (0-6) day ID'lerine çevir
      const userDayIds = user.preferred_running_days
        .map((dayIndex: number) => {
          const day = ALL_DAYS.find((d) => d.index === dayIndex);
          return day ? day.id : null;
        })
        .filter(Boolean) as string[];

      if (userDayIds.length > 0) {
        setSelectedDays(userDayIds);
      }
      setInitialized(true);
    }
  }, [user, initialized]);

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays((prev) => prev.filter((d) => d !== dayId));
      if (longRunDay === dayId) setLongRunDay(null);
    } else {
      setSelectedDays((prev) => [...prev, dayId]);
    }
  };

  const handleSubmit = () => {
    if (selectedDays.length < 1) {
      Alert.alert("Eksik Seçim", "Lütfen en az 1 gün seçmelisin.");
      return;
    }

    onSubmit({
      days: selectedDays,
      long_run: longRunDay,
    });
  };

  if (submitted) {
    const sortedDays = ALL_DAYS.filter((d) => selectedDays.includes(d.id)).map(
      (d) => d.label.substring(0, 3),
    );
    const daySummary = sortedDays.join(", ");
    const longRunLabel = longRunDay
      ? ALL_DAYS.find((d) => d.id === longRunDay)?.label
      : "Otomatik";

    return (
      <View style={styles.submittedCard}>
        <View style={styles.submittedIcon}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedTitle}>
            {selectedDays.length} Gün • Uzun: {longRunLabel}
          </Text>
          <Text style={styles.submittedSubtitle} numberOfLines={1}>
            {daySummary}
          </Text>
        </View>
      </View>
    );
  }

  const isValid = selectedDays.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📅 Haftalık Program</Text>
          <Text style={styles.subtitle}>
            {user?.preferred_running_days &&
            user.preferred_running_days.length > 0
              ? "Günlerini kontrol et veya değiştir"
              : "Koşu günlerini işaretle"}
          </Text>
        </View>
        {selectedDays.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedDays.length} gün</Text>
          </View>
        )}
      </View>

      {/* Haftalık Takvim - Görsel Bloklar */}
      <View style={styles.weekContainer}>
        {ALL_DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.id);
          const isLongRun = longRunDay === day.id;

          return (
            <View key={day.id} style={styles.dayWrapper}>
              <TouchableOpacity
                style={[styles.dayBlock, isSelected && styles.dayBlockActive]}
                onPress={() => toggleDay(day.id)}
                activeOpacity={0.7}
              >
                {/* Gün Harfi */}
                <View style={styles.dayLetterCircle}>
                  <Text
                    style={[
                      styles.dayLetter,
                      isSelected && { color: COLORS.accent },
                    ]}
                  >
                    {day.label[0]}
                  </Text>
                </View>

                {/* Seçim İndikatörü */}
                {isSelected && (
                  <View
                    style={[
                      styles.selectedIndicator,
                      { backgroundColor: COLORS.accent },
                    ]}
                  />
                )}

                {/* Uzun Koşu İşareti */}
                {isLongRun && (
                  <View style={styles.longRunBadge}>
                    <Ionicons name="flame" size={10} color="#000" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Gün İsmi */}
              <Text style={styles.dayLabel}>{day.short}</Text>
            </View>
          );
        })}
      </View>

      {/* Uzun Koşu Seçici */}
      {selectedDays.length > 0 && (
        <View style={styles.longRunSection}>
          <View style={styles.longRunHeader}>
            <View style={styles.longRunTitleRow}>
              <View style={styles.fireIconBox}>
                <Ionicons name="flame" size={14} color={COLORS.accent} />
              </View>
              <Text style={styles.longRunTitle}>Uzun koşu için tercihim</Text>
            </View>
          </View>

          <View style={styles.longRunOptions}>
            {/* Otomatik Seçenek */}
            <TouchableOpacity
              style={[
                styles.longRunOption,
                !longRunDay && styles.longRunOptionActive,
              ]}
              onPress={() => setLongRunDay(null)}
            >
              <Ionicons
                name="sparkles"
                size={16}
                color={!longRunDay ? COLORS.accent : "#666"}
              />
              <Text
                style={[
                  styles.longRunOptionText,
                  !longRunDay && styles.longRunOptionTextActive,
                ]}
              >
                Otomatik
              </Text>
            </TouchableOpacity>

            {/* Seçili Günler */}
            {selectedDays.map((dayId) => {
              const day = ALL_DAYS.find((d) => d.id === dayId);
              const isActive = longRunDay === dayId;
              return (
                <TouchableOpacity
                  key={dayId}
                  style={[
                    styles.longRunOption,
                    isActive && styles.longRunOptionActive,
                  ]}
                  onPress={() => setLongRunDay(dayId)}
                >
                  <Text
                    style={[
                      styles.longRunOptionText,
                      isActive && styles.longRunOptionTextActive,
                    ]}
                  >
                    {day?.short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.btn, !isValid && styles.btnDisabled]}
        disabled={!isValid}
        onPress={handleSubmit}
      >
        <Text style={styles.btnText}>
          {isValid ? "Devam Et" : "En az 1 gün seç"}
        </Text>
        {isValid && <Ionicons name="arrow-forward" size={20} color="#000" />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#888",
  },
  badge: {
    backgroundColor: COLORS.accent + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.accent,
  },

  // Haftalık Takvim
  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayWrapper: {
    alignItems: "center",
    gap: 6,
  },
  dayBlock: {
    width: 38,
    height: 52,
    backgroundColor: "#252525",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  dayBlockActive: {
    backgroundColor: "#2A2A2A",
    borderColor: COLORS.accent,
  },
  dayLetterCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1F1F1F",
    justifyContent: "center",
    alignItems: "center",
  },
  dayLetter: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  selectedIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  longRunBadge: {
    position: "absolute",
    bottom: 3,
    backgroundColor: COLORS.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
  },

  // Uzun Koşu Section
  longRunSection: {
    marginBottom: 14,
  },
  longRunHeader: {
    marginBottom: 10,
  },
  longRunTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fireIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.accent + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  longRunTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CCC",
  },
  longRunOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  longRunOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#252525",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  longRunOptionActive: {
    backgroundColor: COLORS.accent + "15",
    borderColor: COLORS.accent,
  },
  longRunOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  longRunOptionTextActive: {
    color: COLORS.accent,
    fontWeight: "700",
  },

  // Button
  btn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnDisabled: {
    backgroundColor: "#333",
    opacity: 0.7,
  },
  btnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },

  // Submitted
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
});
