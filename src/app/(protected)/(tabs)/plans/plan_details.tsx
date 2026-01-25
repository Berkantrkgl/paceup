import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height, width } = Dimensions.get("window");

// Hem named export (index.tsx için) hem default export (Expo Router hatası için)
export const PlanDetailsModal = ({ visible, onClose, plan }: any) => {
  // 1. Hook'lar en üstte
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionY, setSectionY] = useState<{ [key: string]: number }>({});

  // 2. Data Gruplama
  const groupedWorkouts = useMemo(() => {
    if (!plan || !plan.workouts) return {};
    const groups: { [key: string]: any[] } = {};
    plan.workouts.forEach((workout: any) => {
      const planStart = new Date(plan.start_date);
      const workoutDate = new Date(workout.scheduled_date);
      const diffTime = workoutDate.getTime() - planStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
      if (!groups[weekNum]) groups[weekNum] = [];
      groups[weekNum].push(workout);
    });
    return groups;
  }, [plan]);

  // 3. Hedef Hafta Bulma
  const targetWeek = useMemo(() => {
    const weeks = Object.keys(groupedWorkouts).sort(
      (a, b) => Number(a) - Number(b),
    );
    let lastActiveWeek = weeks[0];
    for (const week of weeks) {
      const hasCompleted = groupedWorkouts[week].some(
        (w: any) => w.is_completed,
      );
      if (hasCompleted) {
        lastActiveWeek = week;
      }
    }
    return lastActiveWeek;
  }, [groupedWorkouts]);

  // 4. Scroll Efekti
  useEffect(() => {
    if (visible && targetWeek && sectionY[targetWeek] !== undefined) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: sectionY[targetWeek],
          animated: true,
        });
      }, 200);
    }
  }, [visible, targetWeek, sectionY]);

  // 5. Erken Return (Hooklardan Sonra)
  if (!plan) return null;

  const getWorkoutUI = (type: string) => {
    const t = type?.toLowerCase();
    if (t === "tempo")
      return {
        icon: "speedometer-outline",
        color: COLORS.secondary,
        label: "Tempo",
      };
    if (t === "easy")
      return { icon: "leaf-outline", color: COLORS.success, label: "Kolay" };
    if (t === "interval")
      return { icon: "flash-outline", color: COLORS.accent, label: "İnterval" };
    if (t === "long")
      return { icon: "infinite-outline", color: COLORS.info, label: "Uzun" };
    return { icon: "fitness-outline", color: COLORS.accent, label: "Koşu" };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContainer}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planSubtitle}>
                {plan.duration_weeks} Haftalık Program
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* LİSTE */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {Object.keys(groupedWorkouts)
              .sort((a, b) => Number(a) - Number(b))
              .map((week) => (
                <View
                  key={week}
                  style={styles.weekSection}
                  onLayout={(event) => {
                    const layout = event.nativeEvent.layout;
                    setSectionY((prev) => ({ ...prev, [week]: layout.y }));
                  }}
                >
                  <View style={styles.weekHeader}>
                    <View style={styles.weekDot} />
                    <Text style={styles.weekTitle}>{week}. HAFTA</Text>
                    <View style={styles.weekLine} />
                  </View>

                  <View style={styles.workoutList}>
                    {groupedWorkouts[week].map(
                      (workout: any, index: number) => {
                        const ui = getWorkoutUI(workout.workout_type);
                        const isLast =
                          index === groupedWorkouts[week].length - 1;

                        return (
                          <View
                            key={workout.id}
                            style={[
                              styles.workoutRow,
                              !isLast && styles.rowBorder,
                            ]}
                          >
                            <View
                              style={[
                                styles.iconContainer,
                                { backgroundColor: ui.color + "15" },
                              ]}
                            >
                              <Ionicons
                                name={ui.icon as any}
                                size={18}
                                color={ui.color}
                              />
                            </View>

                            <View style={styles.infoContainer}>
                              <View style={styles.titleRow}>
                                <Text style={styles.workoutTitle}>
                                  {workout.title}
                                </Text>
                                {workout.planned_distance > 0 && (
                                  <View style={styles.kmTag}>
                                    <Text
                                      style={[
                                        styles.kmText,
                                        { color: COLORS.accent },
                                      ]}
                                    >
                                      {workout.planned_distance} km
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.workoutMeta}>
                                {workout.planned_duration} dk • {ui.label}
                              </Text>
                            </View>

                            <View style={styles.statusContainer}>
                              {workout.is_completed ? (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={22}
                                  color={COLORS.success}
                                />
                              ) : (
                                <View style={styles.emptyCircle} />
                              )}
                            </View>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Expo Router'ın "default export" beklentisini karşılamak için:
export default PlanDetailsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  modalContainer: {
    width: width * 0.95,
    height: height * 0.85,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 13,
    color: COLORS.textDim,
  },
  closeButton: {
    padding: 8,
    backgroundColor: COLORS.cardVariant,
    borderRadius: 20,
  },
  scrollContent: {
    padding: 20,
  },
  weekSection: {
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  weekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginRight: 8,
  },
  weekTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textDim,
    letterSpacing: 1,
    marginRight: 12,
  },
  weekLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.cardBorder,
  },
  workoutList: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  infoContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  kmTag: {
    marginLeft: 8,
    backgroundColor: "rgba(255, 69, 1, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kmText: {
    fontSize: 13,
    fontWeight: "800",
  },
  workoutMeta: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  statusContainer: {
    marginLeft: 12,
  },
  emptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
});
