import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const getWorkoutUI = (type: string) => {
  const t = type?.toLowerCase();
  if (t === "tempo")
    return { icon: "speedometer-outline", color: COLORS.danger, label: "Tempo" };
  if (t === "easy")
    return { icon: "leaf-outline", color: COLORS.success, label: "Kolay" };
  if (t === "interval")
    return { icon: "flash-outline", color: COLORS.warning, label: "İnterval" };
  if (t === "long")
    return { icon: "infinite-outline", color: COLORS.info, label: "Uzun" };
  return { icon: "fitness-outline", color: COLORS.accent, label: "Koşu" };
};

const getStatusUI = (workout: any) => {
  if (workout.is_completed)
    return { icon: "checkmark-circle", color: COLORS.success };
  if (workout.status === "missed")
    return { icon: "close-circle", color: COLORS.danger };
  return { icon: "ellipse-outline", color: COLORS.cardBorder };
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return { day, month: months[d.getMonth()], weekday: DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1] };
};

const formatShortDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][d.getMonth()]}`;
};

const PlanDetailsScreen = () => {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { getValidToken } = useContext(AuthContext);
  const scrollViewRef = useRef<ScrollView>(null);

  const [plan, setPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchPlan = async () => {
      const validToken = await getValidToken();
      if (!validToken || !planId) return;
      try {
        const response = await fetch(`${API_URL}/programs/${planId}/`, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPlan(data);
          // Current week'i varsayılan olarak aç
          const cw = data.current_week_calculated ?? 0;
          if (cw > 0) setExpandedWeeks(new Set([String(cw)]));
        }
      } catch (error) {
        console.log("Fetch plan detail error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

  // Data Gruplama
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

  const toggleWeek = (week: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  };

  // Sıradaki antrenman: tamamlanmamış ve kaçırılmamış ilk antrenman
  const nextWorkoutId = useMemo(() => {
    if (!plan?.workouts) return null;
    const sorted = [...plan.workouts].sort(
      (a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );
    const next = sorted.find((w: any) => !w.is_completed && w.status !== "missed");
    return next?.id ?? null;
  }, [plan]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!plan) return null;

  const progress = plan.progress_percent ?? 0;
  const currentWeek = plan.current_week_calculated ?? 0;
  const workouts = plan.workouts || [];
  const totalKm = Math.round(
    workouts.reduce((sum: number, w: any) => sum + (w.planned_distance || 0), 0) * 10
  ) / 10;
  const completed = plan.completed_workouts_count || 0;
  const total = plan.total_workouts_count || 0;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.planTitle} numberOfLines={2}>{plan.title}</Text>

          {plan.goal ? (
            <View style={styles.goalRow}>
              <Ionicons name="flag-outline" size={14} color={COLORS.accent} />
              <Text style={styles.goalText} numberOfLines={2}>{plan.goal}</Text>
            </View>
          ) : null}

          {plan.description ? (
            <Text style={styles.descText} numberOfLines={3}>{plan.description}</Text>
          ) : null}

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPercent}>%{progress}</Text>
              <Text style={styles.progressSubtext}>{completed}/{total} antrenman tamamlandı</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>
        </View>

        {/* STAT KARTLARI — 2x2 grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.accent + "15" }]}>
              <Ionicons name="map-outline" size={18} color={COLORS.accent} />
            </View>
            <Text style={styles.statValue}>{totalKm} km</Text>
            <Text style={styles.statLabel}>Toplam Mesafe</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.info + "15" }]}>
              <Ionicons name="fitness-outline" size={18} color={COLORS.info} />
            </View>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Antrenman</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.success + "15" }]}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.success} />
            </View>
            <Text style={styles.statValue}>{currentWeek}/{plan.duration_weeks}</Text>
            <Text style={styles.statLabel}>Hafta</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.secondary + "15" }]}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.secondary} />
            </View>
            <Text style={styles.statValue}>{formatShortDate(plan.start_date)}</Text>
            <Text style={styles.statLabel}>Başlangıç</Text>
          </View>
        </View>

        {/* HAFTALIK LİSTE — Collapsible */}
        <View style={styles.weeksContainer}>
          <Text style={styles.weeksSectionTitle}>Antrenman Programı</Text>

          {Object.keys(groupedWorkouts)
            .sort((a, b) => Number(a) - Number(b))
            .map((week) => {
              const isCurrentWeek = Number(week) === currentWeek;
              const isExpanded = expandedWeeks.has(week);
              const weekWorkouts = groupedWorkouts[week];
              const weekCompleted = weekWorkouts.filter((w: any) => w.is_completed).length;
              const weekTotal = weekWorkouts.length;
              const weekKm = Math.round(
                weekWorkouts.reduce((sum: number, w: any) => sum + (w.planned_distance || 0), 0) * 10
              ) / 10;
              return (
                <View key={week} style={styles.weekSection}>
                  {/* Hafta başlığı — Tıklanabilir */}
                  <Pressable
                    onPress={() => toggleWeek(week)}
                    style={({ pressed }) => [
                      styles.weekHeader,
                      isCurrentWeek && styles.weekHeaderActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={styles.weekHeaderLeft}>
                      <Text style={[styles.weekTitle, isCurrentWeek && styles.weekTitleActive]}>
                        {week}. Hafta
                      </Text>
                    </View>
                    <View style={styles.weekHeaderRight}>
                      <Text style={styles.weekMetaText}>
                        {weekCompleted}/{weekTotal} • {weekKm} km
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={COLORS.textDim}
                      />
                    </View>
                  </Pressable>

                  {/* Antrenmanlar — Collapsible */}
                  {isExpanded && (
                    <View style={styles.weekContent}>
                      {weekWorkouts.map((workout: any, index: number) => {
                        const ui = getWorkoutUI(workout.workout_type);
                        const statusUI = getStatusUI(workout);
                        const isLast = index === weekTotal - 1;
                        const date = formatDate(workout.scheduled_date);
                        const isNext = workout.id === nextWorkoutId;

                        return (
                          <View key={workout.id} style={styles.workoutRow}>
                            {/* Tarih */}
                            <View style={styles.dateCol}>
                              <Text style={styles.dateDay}>{date.day}</Text>
                              <Text style={styles.dateMonth}>{date.month}</Text>
                              <Text style={styles.dateWeekday}>{date.weekday}</Text>
                            </View>

                            {/* Timeline */}
                            <View style={styles.timelineCol}>
                              <View style={[styles.timelineDot, { backgroundColor: ui.color }]} />
                              {!isLast && <View style={styles.timelineLine} />}
                            </View>

                            {/* İçerik */}
                            <View style={[styles.workoutContent, isNext && styles.workoutContentNext]}>
                              <View style={styles.workoutHeader}>
                                <View style={[styles.typeBadge, { backgroundColor: ui.color + "18" }]}>
                                  <Ionicons name={ui.icon as any} size={12} color={ui.color} />
                                  <Text style={[styles.typeBadgeText, { color: ui.color }]}>{ui.label}</Text>
                                </View>
                                <Ionicons name={statusUI.icon as any} size={20} color={statusUI.color} />
                              </View>

                              <Text style={styles.workoutTitle}>{workout.title}</Text>

                              <View style={styles.workoutDetails}>
                                {workout.planned_distance > 0 && (
                                  <View style={styles.detailChip}>
                                    <Ionicons name="navigate-outline" size={11} color={COLORS.textDim} />
                                    <Text style={styles.detailText}>{workout.planned_distance} km</Text>
                                  </View>
                                )}
                                {workout.planned_duration > 0 && (
                                  <View style={styles.detailChip}>
                                    <Ionicons name="time-outline" size={11} color={COLORS.textDim} />
                                    <Text style={styles.detailText}>{workout.planned_duration} dk</Text>
                                  </View>
                                )}
                                {workout.pace_display && workout.pace_display !== "-" && (
                                  <View style={styles.detailChip}>
                                    <Ionicons name="speedometer-outline" size={11} color={COLORS.textDim} />
                                    <Text style={styles.detailText}>{workout.pace_display}/km</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default PlanDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // HEADER
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 6,
  },
  goalText: {
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
    lineHeight: 18,
  },
  descText: {
    fontSize: 13,
    color: COLORS.textDim,
    lineHeight: 18,
    marginBottom: 4,
  },

  // PROGRESS
  progressSection: {
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.accent,
  },
  progressSubtext: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.cardVariant,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },

  // STAT KARTLARI — 2x2 grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textDim,
  },

  // HAFTALIK BÖLÜM
  weeksContainer: {
    paddingHorizontal: 20,
  },
  weeksSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  weekSection: {
    marginBottom: 12,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  weekHeaderActive: {
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  weekHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  weekTitleActive: {
    color: COLORS.accent,
  },
  weekHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weekMetaText: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  weekContent: {
    paddingTop: 16,
    paddingLeft: 4,
  },

  // ANTRENMAN SATIRLARI
  workoutRow: {
    flexDirection: "row",
    paddingBottom: 16,
  },

  // Tarih
  dateCol: {
    width: 36,
    alignItems: "center",
    marginRight: 10,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  dateMonth: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: "600",
    marginTop: 1,
  },
  dateWeekday: {
    fontSize: 9,
    color: COLORS.textDim,
    marginTop: 2,
  },

  // Timeline
  timelineCol: {
    width: 20,
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.cardBorder,
    marginTop: 4,
  },

  // İçerik
  workoutContent: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
  },
  workoutContentNext: {
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  workoutDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textDim,
  },
});
