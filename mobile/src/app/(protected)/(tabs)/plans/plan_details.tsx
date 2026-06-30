import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme, ThemeColors } from "@/theme/tokens";
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
  Text,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const getWorkoutUI = (type: string, c: ThemeColors) => {
  const t = type?.toLowerCase();
  if (t === "tempo")
    return { icon: "speedometer-outline", color: c.danger, label: "Tempo" };
  if (t === "easy")
    return { icon: "leaf-outline", color: c.success, label: "Kolay" };
  if (t === "interval")
    return { icon: "flash-outline", color: c.warning, label: "İnterval" };
  if (t === "long")
    return { icon: "infinite-outline", color: c.info, label: "Uzun" };
  return { icon: "fitness-outline", color: c.accent, label: "Koşu" };
};

const getStatusUI = (workout: any, c: ThemeColors) => {
  if (workout.is_completed)
    return { icon: "checkmark-circle", color: c.success };
  if (workout.status === "missed")
    return { icon: "close-circle", color: c.danger };
  return { icon: "ellipse-outline", color: c.border };
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <ActivityIndicator size="large" color={colors.accent} />
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
              <Ionicons name="flag-outline" size={14} color={colors.accent} />
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
            <View style={[styles.statIconWrap, { backgroundColor: colors.accent + "15" }]}>
              <Ionicons name="map-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.statValue}>{totalKm} km</Text>
            <Text style={styles.statLabel}>Toplam Mesafe</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.info + "15" }]}>
              <Ionicons name="fitness-outline" size={18} color={colors.info} />
            </View>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Antrenman</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.success + "15" }]}>
              <Ionicons name="navigate-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.statValue}>{currentWeek}/{plan.duration_weeks}</Text>
            <Text style={styles.statLabel}>Hafta</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.secondary + "15" }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
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
                        color={colors.text.secondary}
                      />
                    </View>
                  </Pressable>

                  {/* Antrenmanlar — Collapsible */}
                  {isExpanded && (
                    <View style={styles.weekContent}>
                      {weekWorkouts.map((workout: any, index: number) => {
                        const ui = getWorkoutUI(workout.workout_type, colors);
                        const statusUI = getStatusUI(workout, colors);
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
                                    <Ionicons name="navigate-outline" size={11} color={colors.text.secondary} />
                                    <Text style={styles.detailText}>{workout.planned_distance} km</Text>
                                  </View>
                                )}
                                {workout.planned_duration > 0 && (
                                  <View style={styles.detailChip}>
                                    <Ionicons name="time-outline" size={11} color={colors.text.secondary} />
                                    <Text style={styles.detailText}>{workout.planned_duration} dk</Text>
                                  </View>
                                )}
                                {workout.pace_display && workout.pace_display !== "-" && (
                                  <View style={styles.detailChip}>
                                    <Ionicons name="speedometer-outline" size={11} color={colors.text.secondary} />
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

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center" as const,
      alignItems: "center" as const,
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
      fontWeight: "800" as const,
      color: c.text.primary,
      marginBottom: 8,
    },
    goalRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: 6,
      marginBottom: 6,
    },
    goalText: {
      fontSize: 13,
      color: c.text.secondary,
      flex: 1,
      lineHeight: 18,
    },
    descText: {
      fontSize: 13,
      color: c.text.secondary,
      lineHeight: 18,
      marginBottom: 4,
    },

    // PROGRESS
    progressSection: {
      marginTop: 16,
    },
    progressHeader: {
      flexDirection: "row" as const,
      alignItems: "baseline" as const,
      gap: 8,
      marginBottom: 8,
    },
    progressPercent: {
      fontSize: 28,
      fontWeight: "900" as const,
      color: c.accent,
    },
    progressSubtext: {
      fontSize: 12,
      color: c.text.secondary,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: c.surfaceVariant,
      borderRadius: 3,
      overflow: "hidden" as const,
    },
    progressBarFill: {
      height: "100%" as const,
      backgroundColor: c.accent,
      borderRadius: 3,
    },

    // STAT KARTLARI — 2x2 grid
    statsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 28,
    },
    statCard: {
      width: "47%" as const,
      flexGrow: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    statIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: c.text.primary,
    },
    statLabel: {
      fontSize: 11,
      color: c.text.secondary,
    },

    // HAFTALIK BÖLÜM
    weeksContainer: {
      paddingHorizontal: 20,
    },
    weeksSectionTitle: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 16,
    },
    weekSection: {
      marginBottom: 12,
    },
    weekHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    weekHeaderActive: {
      borderWidth: 1,
      borderColor: c.accent + "40",
    },
    weekHeaderLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    weekTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
    },
    weekTitleActive: {
      color: c.accent,
    },
    weekHeaderRight: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    weekMetaText: {
      fontSize: 12,
      color: c.text.secondary,
    },
    weekContent: {
      paddingTop: 16,
      paddingLeft: 4,
    },

    // ANTRENMAN SATIRLARI
    workoutRow: {
      flexDirection: "row" as const,
      paddingBottom: 16,
    },

    // Tarih
    dateCol: {
      width: 36,
      alignItems: "center" as const,
      marginRight: 10,
    },
    dateDay: {
      fontSize: 18,
      fontWeight: "800" as const,
      color: c.text.primary,
    },
    dateMonth: {
      fontSize: 10,
      color: c.text.secondary,
      fontWeight: "600" as const,
      marginTop: 1,
    },
    dateWeekday: {
      fontSize: 9,
      color: c.text.secondary,
      marginTop: 2,
    },

    // Timeline
    timelineCol: {
      width: 20,
      alignItems: "center" as const,
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
      backgroundColor: c.border,
      marginTop: 4,
    },

    // İçerik
    workoutContent: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
    },
    workoutContentNext: {
      borderWidth: 1,
      borderColor: c.accent + "40",
    },
    workoutHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 8,
    },
    typeBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: "700" as const,
    },
    workoutTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: c.text.primary,
      marginBottom: 8,
    },
    workoutDetails: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    },
    detailChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    detailText: {
      fontSize: 12,
      color: c.text.secondary,
    },
  } as const;
};
