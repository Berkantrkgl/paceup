import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";

import { API_URL } from "@/constants/Config";
import { GREETINGS, HEADER_IMAGES, MOTIVATION_QUOTES } from "@/constants/Content";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme, ThemeColors } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";
import { HomeTour } from "@/components/tour/HomeTour";

const { width } = Dimensions.get("window");

// --- TYPES ---
type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

type Workout = {
  id: string;
  title: string;
  workout_type: WorkoutTypeEnum;
  scheduled_date: string;
  planned_duration: number;
  planned_distance: number;
  target_pace_seconds?: number | null;
  status: "scheduled" | "completed" | "missed" | "skipped";
  is_completed: boolean;
};

// --- HELPERS ---
// Theme'e bağlı olduğu için colors'ı parametre olarak alır.
const getWorkoutTypeStyle = (type: WorkoutTypeEnum, c: ThemeColors) => {
  switch (type) {
    case "tempo":
      return {
        icon: "speedometer",
        color: c.danger,
        name: "Tempo Koşusu",
        bgGradient: [c.danger + "40", c.surface],
      };
    case "easy":
      return {
        icon: "leaf",
        color: c.success,
        name: "Hafif Koşu",
        bgGradient: [c.success + "40", c.surface],
      };
    case "interval":
      return {
        icon: "flash",
        color: c.warning,
        name: "İnterval",
        bgGradient: [c.warning + "40", c.surface],
      };
    case "long":
      return {
        icon: "infinite",
        color: c.info,
        name: "Uzun Koşu",
        bgGradient: [c.info + "40", c.surface],
      };
    case "rest":
      return {
        icon: "moon",
        color: c.text.secondary,
        name: "Dinlenme",
        bgGradient: [c.surfaceVariant, c.surface],
      };
    default:
      return {
        icon: "fitness",
        color: c.secondary,
        name: "Koşu",
        bgGradient: [c.secondary + "40", c.surface],
      };
  }
};

const HomeScreen = () => {
  const { user, getValidToken, refreshUserData } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Tour highlight refs
  const workoutRef = useRef<View>(null);
  const progressLinkRef = useRef<View>(null);
  const statsRef = useRef<View>(null);

  // --- RANDOM CONTENT LOGIC ---
  const randomQuote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATION_QUOTES.length);
    return MOTIVATION_QUOTES[randomIndex];
  }, []);

  const randomImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * HEADER_IMAGES.length);
    return HEADER_IMAGES[randomIndex];
  }, []);

  const randomGreetingTemplate = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    return GREETINGS[randomIndex];
  }, []);

  // --- DATA FETCHING ---
  const fetchTodayWorkout = async () => {
    const validToken = await getValidToken();
    if (!validToken) return;
    try {
      const response = await fetch(`${API_URL}/workouts/?only_active=true`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      if (response.ok) {
        const json = await response.json();
        const workouts: Workout[] = Array.isArray(json)
          ? json
          : json.results || [];
        const todayStr = new Date().toLocaleDateString("en-CA");
        const today = workouts.find((w) => w.scheduled_date === todayStr);
        setTodayWorkout(today || null);
      }
    } catch (error) {
      console.log("Workout fetch error:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTodayWorkout();
      refreshUserData();
    }, []),
  );

  const handleQuickComplete = () => {
    if (!todayWorkout) return;
    Alert.alert("Antrenmanı Tamamla", "Tamamlandı olarak işaretlensin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Evet, Tamamla",
        onPress: async () => {
          setIsCompleting(true);
          const validToken = await getValidToken();
          try {
            await fetch(`${API_URL}/workouts/${todayWorkout.id}/`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${validToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "completed" }),
            });
            const resultData = {
              workout: todayWorkout.id,
              completed_at: new Date().toISOString(),
              actual_duration: todayWorkout.planned_duration || 30,
              actual_distance: todayWorkout.planned_distance || 5.0,
              feeling: "normal",
            };
            const postRes = await fetch(`${API_URL}/results/`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${validToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(resultData),
            });
            if (!postRes.ok) throw new Error("Result failed");
            await Promise.all([refreshUserData(), fetchTodayWorkout()]);
            Alert.alert("Tebrikler!", "Antrenman kaydedildi.");
          } catch {
            Alert.alert("Hata", "İşlem başarısız oldu.");
          } finally {
            setIsCompleting(false);
          }
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUserData(), fetchTodayWorkout()]);
    setRefreshing(false);
  }, []);

  const formatWorkoutDate = (dateString: string) => {
    // YYYY-MM-DD string olarak karşılaştır — timezone farkından etkilenmez
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const isToday = dateString === todayStr;

    // Görüntüleme için tarih oluştur (sadece gün/ay)
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day); // Local timezone

    return {
      day: date.getDate(),
      month: date.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase(),
      isToday: isToday,
    };
  };

  if (!user) {
    return (
      <View style={[styles.mainContainer, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // --- UI VARS ---
  const formattedName = user.first_name ? user.first_name : user.username;
  const totalWorkouts = user.total_workouts || 0;
  const totalDistance = user.total_distance?.toFixed(1) || "0.0";
  const streak = user.current_streak || 0;

  const workoutStyle = todayWorkout
    ? getWorkoutTypeStyle(todayWorkout.workout_type, colors)
    : null;
  const dateInfo = todayWorkout
    ? formatWorkoutDate(todayWorkout.scheduled_date)
    : null;

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressViewOffset={StatusBar.currentHeight}
          />
        }
      >
        {/* --- HERO HEADER (FULL WIDTH & DYNAMIC) --- */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={randomImage}
            style={styles.heroImage}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["transparent", colors.background]
                  : ["transparent", "rgba(0,0,0,0.55)", colors.background]
              }
              locations={isDark ? [0, 1] : [0.15, 0.75, 1]}
              style={styles.heroGradient}
            >
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroGreeting}>
                  {randomGreetingTemplate.replace("{name}", formattedName)}
                </Text>
                <Text style={styles.heroMotivation}>{randomQuote}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        <View style={styles.contentOverlappingContainer}>
          {/* FLOATING STATS ROW */}
              <View ref={statsRef} style={styles.floatingStatsContainer}>
                {/* Distance (SOL) */}
                <Link href={"/progress"} asChild push>
                  <Pressable style={[styles.statCard, styles.statCardMain]}>
                    <View style={styles.statIconRow}>
                      <Ionicons
                        name="map"
                        size={20}
                        color={colors.accent}
                        style={styles.statIcon}
                      />
                      <Text style={styles.statLabelMain}>Toplam Mesafe</Text>
                    </View>
                    <Text style={styles.statValueMain}>
                      {totalDistance}{" "}
                      <Text style={styles.statUnitMain}>km</Text>
                    </Text>
                  </Pressable>
                </Link>

                {/* SAĞ SÜTUN (FIXED) */}
                <View style={styles.statsColumnRight}>
                  <Link href={"/progress"} asChild push>
                    <Pressable style={styles.statCardSmall}>
                      <View
                        style={[
                          styles.iconBoxSmall,
                          {
                            backgroundColor: colors.secondary + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name="fitness"
                          size={18}
                          color={colors.secondary}
                        />
                      </View>
                      <View>
                        <Text style={styles.statValueSmall}>
                          {totalWorkouts}
                        </Text>
                        <Text style={styles.statLabelSmall}>Antrenman</Text>
                      </View>
                    </Pressable>
                  </Link>

                  <Link href={"/progress"} asChild push>
                    <Pressable style={styles.statCardSmall}>
                      <View
                        style={[
                          styles.iconBoxSmall,
                          {
                            backgroundColor: colors.warning + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name="flame"
                          size={18}
                          color={colors.warning}
                        />
                      </View>
                      <View>
                        <Text style={styles.statValueSmall}>{streak} Gün</Text>
                        <Text style={styles.statLabelSmall}>Seri</Text>
                      </View>
                    </Pressable>
                  </Link>
                </View>
              </View>

              {/* NEXT WORKOUT CARD */}
              <View ref={workoutRef} style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Bugünün Antrenmanı</Text>
                {todayWorkout && workoutStyle && dateInfo ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/(protected)/(tabs)/calendar/workout-detail",
                        params: {
                          workoutId: todayWorkout.id,
                        },
                      })
                    }
                  >
                    <LinearGradient
                      colors={
                        isDark
                          ? [workoutStyle.color + "22", colors.surface]
                          : [workoutStyle.color, workoutStyle.color + "A0"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.workoutCard}
                    >
                      {/* TOP ROW: tip + tarih */}
                      <View style={styles.cardTopRow}>
                        {/* TİP BADGE */}
                        <View
                          style={[
                            styles.typePill,
                            {
                              backgroundColor: workoutStyle.color + "25",
                            },
                          ]}
                        >
                          <Ionicons
                            name={workoutStyle.icon as any}
                            size={14}
                            color={workoutStyle.color}
                          />
                          <Text
                            style={[
                              styles.typePillText,
                              { color: workoutStyle.color },
                            ]}
                          >
                            {workoutStyle.name.toUpperCase()}
                          </Text>
                        </View>

                        {/* STATUS BADGE */}
                        {todayWorkout.status === "completed" ? (
                          <View
                            style={[
                              styles.cornerBadge,
                              {
                                backgroundColor: colors.success + "18",
                                borderColor: colors.success + "40",
                              },
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={colors.success}
                            />
                            <Text
                              style={[
                                styles.cornerBadgeText,
                                { color: colors.success },
                              ]}
                            >
                              Tamamlandı
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.cornerBadge,
                              {
                                backgroundColor: workoutStyle.color + "18",
                                borderColor: workoutStyle.color + "40",
                              },
                            ]}
                          >
                            {dateInfo.isToday && (
                              <View
                                style={[
                                  styles.todayDot,
                                  { backgroundColor: workoutStyle.color },
                                ]}
                              />
                            )}
                            <Text
                              style={[
                                styles.cornerBadgeText,
                                { color: workoutStyle.color },
                              ]}
                            >
                              {dateInfo.isToday
                                ? "Bugün"
                                : `${dateInfo.day} ${dateInfo.month}`}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* WORKOUT NAME */}
                      <Text
                        style={[
                          styles.cardWorkoutName,
                          !isDark && { color: colors.white },
                        ]}
                        numberOfLines={2}
                      >
                        {todayWorkout.title}
                      </Text>

                      {/* DIVIDER */}
                      <View
                        style={[
                          styles.cardDivider,
                          !isDark && { backgroundColor: "rgba(255,255,255,0.35)" },
                        ]}
                      />

                      {/* META ROW */}
                      <View style={styles.cardMetaRow}>
                        <View style={styles.cardMetaItem}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={isDark ? colors.text.secondary : colors.white}
                          />
                          <Text
                            style={[
                              styles.cardMetaText,
                              !isDark && { color: colors.white },
                            ]}
                          >
                            {todayWorkout.planned_duration} dk
                          </Text>
                        </View>
                        {todayWorkout.planned_distance > 0 && (
                          <View style={styles.cardMetaItem}>
                            <Ionicons
                              name="location-outline"
                              size={16}
                              color={isDark ? colors.text.secondary : colors.white}
                            />
                            <Text
                              style={[
                                styles.cardMetaText,
                                !isDark && { color: colors.white },
                              ]}
                            >
                              {todayWorkout.planned_distance} km
                            </Text>
                          </View>
                        )}
                        {todayWorkout.target_pace_seconds && (
                          <View style={styles.cardMetaItem}>
                            <Ionicons
                              name="speedometer-outline"
                              size={16}
                              color={isDark ? colors.text.secondary : colors.white}
                            />
                            <Text
                              style={[
                                styles.cardMetaText,
                                !isDark && { color: colors.white },
                              ]}
                            >
                              {Math.floor(
                                todayWorkout.target_pace_seconds / 60,
                              )}
                              :
                              {(todayWorkout.target_pace_seconds % 60)
                                .toString()
                                .padStart(2, "0")}{" "}
                              /km
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }} />
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={isDark ? colors.border : "rgba(255,255,255,0.7)"}
                        />
                      </View>

                      {/* TAMAMLA BUTONU — sadece bugün ve tamamlanmamışsa */}
                      {dateInfo.isToday &&
                        todayWorkout.status !== "completed" && (
                          <Pressable
                            style={[
                              styles.quickCompleteButton,
                              { backgroundColor: workoutStyle.color },
                            ]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleQuickComplete();
                            }}
                            disabled={isCompleting}
                          >
                            {isCompleting ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.text.inverse}
                              />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={18}
                                  color={colors.text.inverse}
                                />
                                <Text style={styles.quickCompleteText}>
                                  Antrenmanı Tamamla
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => router.push("/(protected)/(tabs)/calendar")}
                  >
                    <View style={styles.emptyWorkoutTicket}>
                      <Ionicons
                        name="calendar-clear-outline"
                        size={32}
                        color={colors.text.secondary}
                      />
                      <Text style={styles.emptyTicketText}>
                        Bugün antrenman yok.
                      </Text>
                      <Text style={styles.emptyTicketSubText}>
                        Takvimden yeni bir antrenman ekleyebilirsin.
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>

              {/* PROGRESS LINK */}
              <View ref={progressLinkRef}>
              <Link href={"/progress"} asChild push>
                <Pressable>
                  <LinearGradient
                    colors={
                      isDark
                        ? [colors.accent + "20", colors.surface]
                        : [colors.accent, colors.accent + "A0"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.progressLinkCard}
                  >
                    <View style={styles.progressLinkLeft}>
                      <View
                        style={[
                          styles.progressLinkIconWrap,
                          !isDark && {
                            backgroundColor: "rgba(255,255,255,0.25)",
                          },
                        ]}
                      >
                        <Ionicons
                          name="stats-chart"
                          size={22}
                          color={isDark ? colors.accent : colors.white}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.progressLinkTitle,
                            !isDark && { color: colors.white },
                          ]}
                        >
                          İstatistikleri Görüntüle
                        </Text>
                        <Text
                          style={[
                            styles.progressLinkDesc,
                            !isDark && { color: "rgba(255,255,255,0.85)" },
                          ]}
                        >
                          Koşu istatistiklerini incele
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={isDark ? colors.accent : colors.white}
                    />
                  </LinearGradient>
                </Pressable>
              </Link>
              </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* APP TOUR */}
      <HomeTour
        highlightRefs={{
          workout: workoutRef,
          progressLink: progressLinkRef,
          stats: statsRef,
        }}
      />
    </View>
  );
};

export default HomeScreen;

// --- STYLING (THEMED) ---
const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    mainContainer: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },

    // HERO HEADER
    heroContainer: {
      height: 320,
      width: width,
      backgroundColor: c.surface,
    },
    heroImage: {
      flex: 1,
      justifyContent: "flex-end" as const,
    },
    heroGradient: {
      height: "100%" as const,
      justifyContent: "flex-end" as const,
      paddingHorizontal: 20,
      paddingBottom: 50,
    },
    heroTextContainer: {
      marginBottom: 20,
    },
    // Hero text'leri resim üstünde — her temada beyaz kalır.
    heroGreeting: {
      color: c.white,
      fontSize: 34,
      fontWeight: "800" as const,
      letterSpacing: 0.5,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: -1, height: 1 },
      textShadowRadius: 10,
    },
    heroMotivation: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: 16,
      fontWeight: "600" as const,
      marginTop: 8,
      fontStyle: "italic" as const,
      textShadowColor: "rgba(0, 0, 0, 0.5)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },

    // CONTENT CONTAINER
    contentOverlappingContainer: {
      paddingHorizontal: 20,
      marginTop: -40,
      zIndex: 10,
    },

    // --- NO PLAN STATE ---
    noPlanContainer: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 30,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 5,
    },
    noPlanIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.background,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    noPlanTitle: {
      color: c.text.primary,
      fontSize: 26,
      fontWeight: "bold" as const,
      marginBottom: 12,
      textAlign: "center" as const,
    },
    noPlanDesc: {
      color: c.text.secondary,
      fontSize: 16,
      textAlign: "center" as const,
      marginBottom: 25,
      lineHeight: 24,
    },
    createPlanButtonLarge: {
      width: "100%" as const,
      borderRadius: 16,
      overflow: "hidden" as const,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
      marginBottom: 20,
    },
    createPlanGradient: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    createPlanButtonText: {
      color: c.text.inverse,
      fontSize: 18,
      fontWeight: "bold" as const,
    },
    emptyStatsRow: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 15,
      width: "100%" as const,
      alignItems: "center" as const,
    },
    emptyStatsText: {
      color: c.inactive,
      fontSize: 14,
      fontWeight: "600" as const,
    },

    // --- ACTIVE STATE ---

    // Floating Stats
    floatingStatsContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      gap: 12,
      marginBottom: 30,
    },
    statCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    statCardMain: {
      flex: 1.2,
      justifyContent: "space-between" as const,
      height: 160,
    },
    statsColumnRight: {
      flex: 1,
      justifyContent: "space-between" as const,
      gap: 12,
      height: 160,
    },
    statCardSmall: {
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      flex: 1,
      justifyContent: "flex-start" as const,
    },
    iconBoxSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    statIconRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: 10,
    },
    statIcon: {
      marginRight: 8,
    },
    statLabelMain: {
      color: c.text.primary,
      fontSize: 14,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    statValueMain: {
      color: c.text.primary,
      fontSize: 36,
      fontWeight: "900" as const,
    },
    statUnitMain: {
      fontSize: 18,
      color: c.accent,
      fontWeight: "600" as const,
    },
    statValueSmall: {
      color: c.text.primary,
      fontSize: 18,
      fontWeight: "bold" as const,
    },
    statLabelSmall: {
      color: c.text.secondary,
      fontSize: 12,
    },

    // Section
    sectionContainer: {
      marginBottom: 25,
    },
    sectionTitle: {
      color: c.text.primary,
      fontSize: 20,
      fontWeight: "700" as const,
      marginBottom: 15,
      marginLeft: 5,
    },

    emptyWorkoutTicket: {
      backgroundColor: t.name === "light" ? "#E8DFCB" : c.surfaceVariant,
      borderRadius: 22,
      padding: 25,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: t.name === "light" ? "#C8B99E" : c.border,
      borderStyle: "dashed" as const,
    },
    emptyTicketText: {
      color: c.text.primary,
      fontSize: 16,
      fontWeight: "600" as const,
      marginTop: 10,
    },
    emptyTicketSubText: {
      color: c.text.secondary,
      fontSize: 13,
      marginTop: 5,
    },

    // Progress Link
    progressLinkCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.accent + "30",
      marginTop: 10,
    },
    progressLinkLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
    },
    progressLinkIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.accent + "18",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    progressLinkTitle: {
      color: c.text.primary,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    progressLinkDesc: {
      color: c.text.secondary,
      fontSize: 12,
      marginTop: 2,
    },
    quickCompleteButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      marginTop: 16,
    },
    quickCompleteText: {
      color: c.text.inverse,
      fontSize: 15,
      fontWeight: "700" as const,
    },

    // --- NEW WORKOUT CARD ---
    workoutCard: {
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    cardTopRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 14,
    },
    typePill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      alignSelf: "flex-start" as const,
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    typePillText: {
      fontSize: 11,
      fontWeight: "800" as const,
      letterSpacing: 0.5,
    },
    datePill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.surfaceVariant,
      borderWidth: 1,
      borderColor: c.border,
    },
    datePillText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: c.text.secondary,
    },
    cardWorkoutName: {
      fontSize: 22,
      fontWeight: "800" as const,
      color: c.text.primary,
      lineHeight: 28,
      marginBottom: 14,
    },
    cardDivider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: 14,
    },
    cardMetaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 16,
    },
    cardMetaItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    cardMetaText: {
      color: c.text.secondary,
      fontSize: 14,
      fontWeight: "600" as const,
    },
    cornerBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    cornerBadgeText: {
      fontSize: 12,
      fontWeight: "700" as const,
      letterSpacing: 0.3,
    },
    todayDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  } as const;
};
