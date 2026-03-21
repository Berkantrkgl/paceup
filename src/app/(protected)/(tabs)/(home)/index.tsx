import { Ionicons } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
// useMemo'yu import etmeyi unutma
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
// Yeni oluşturduğumuz içerik dosyasını import et
import { HEADER_IMAGES, MOTIVATION_QUOTES } from "@/constants/Content";
import { AuthContext } from "@/utils/authContext";

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
const getWorkoutTypeStyle = (type: WorkoutTypeEnum) => {
  switch (type) {
    case "tempo":
      return {
        icon: "speedometer",
        color: COLORS.danger,
        name: "Tempo Koşusu",
        bgGradient: [COLORS.danger + "40", COLORS.card],
      };
    case "easy":
      return {
        icon: "leaf",
        color: COLORS.success,
        name: "Hafif Koşu",
        bgGradient: [COLORS.success + "40", COLORS.card],
      };
    case "interval":
      return {
        icon: "flash",
        color: COLORS.warning,
        name: "İnterval",
        bgGradient: [COLORS.warning + "40", COLORS.card],
      };
    case "long":
      return {
        icon: "infinite",
        color: COLORS.info,
        name: "Uzun Koşu",
        bgGradient: [COLORS.info + "40", COLORS.card],
      };
    case "rest":
      return {
        icon: "moon",
        color: COLORS.textDim,
        name: "Dinlenme",
        bgGradient: [COLORS.cardVariant, COLORS.card],
      };
    default:
      return {
        icon: "fitness",
        color: COLORS.secondary,
        name: "Koşu",
        bgGradient: [COLORS.secondary + "40", COLORS.card],
      };
  }
};

const HomeScreen = () => {
  const { user, getValidToken, refreshUserData } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // --- RANDOM CONTENT LOGIC ---
  // useMemo kullanarak sadece component ilk yüklendiğinde rastgele seçim yapmasını sağlıyoruz.
  // Her render'da değişmemesi için bu önemli.
  const randomQuote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATION_QUOTES.length);
    return MOTIVATION_QUOTES[randomIndex];
  }, []);

  const randomImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * HEADER_IMAGES.length);
    return HEADER_IMAGES[randomIndex];
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
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // --- UI VARS ---
  const formattedName = user.first_name ? user.first_name : user.username;
  const totalWorkouts = user.total_workouts || 0;
  const totalDistance = user.total_distance?.toFixed(1) || "0.0";
  const streak = user.current_streak || 0;

  const hasExistingPlan = totalWorkouts > 0 || todayWorkout !== null;

  const workoutStyle = todayWorkout
    ? getWorkoutTypeStyle(todayWorkout.workout_type)
    : null;
  const dateInfo = todayWorkout
    ? formatWorkoutDate(todayWorkout.scheduled_date)
    : null;

  return (
    <View style={styles.mainContainer}>
      <StatusBar
        barStyle="light-content"
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
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
            progressViewOffset={StatusBar.currentHeight}
          />
        }
      >
        {/* --- HERO HEADER (FULL WIDTH & DYNAMIC) --- */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={randomImage} // <-- ARTIK RASTGELE RESİM
            style={styles.heroImage}
          >
            <LinearGradient
              colors={["transparent", COLORS.background]}
              style={styles.heroGradient}
            >
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroGreeting}>Selam, {formattedName}</Text>
                {/* --- RASTGELE MOTİVASYON SÖZÜ --- */}
                <Text style={styles.heroMotivation}>{randomQuote}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        <View style={styles.contentOverlappingContainer}>
          {/* --- PLAN YOKSA --- */}
          {!hasExistingPlan ? (
            <View style={styles.noPlanContainer}>
              <View style={styles.noPlanIconCircle}>
                <Ionicons name="footsteps" size={48} color={COLORS.accent} />
              </View>
              <Text style={styles.noPlanTitle}>İlk Adımı At</Text>
              <Text style={styles.noPlanDesc}>
                Henüz aktif bir koşu planın görünmüyor. Yapay zeka koçunla tanış
                ve hedefine uygun sana özel programı hemen oluştur.
              </Text>

              <Link href={"/(protected)/(tabs)/plans/chatbot"} asChild>
                <Pressable style={styles.createPlanButtonLarge}>
                  <LinearGradient
                    colors={[COLORS.accent, COLORS.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.createPlanGradient}
                  >
                    <Text style={styles.createPlanButtonText}>
                      AI ile Plan Oluştur
                    </Text>
                    <Ionicons
                      name="arrow-forward-circle"
                      size={28}
                      color={COLORS.white}
                    />
                  </LinearGradient>
                </Pressable>
              </Link>
              <View style={styles.emptyStatsRow}>
                <Text style={styles.emptyStatsText}>
                  0 km Mesafe • 0 Antrenman
                </Text>
              </View>
            </View>
          ) : (
            /* --- PLAN VARSA --- */
            <>
              {/* FLOATING STATS ROW */}
              <View style={styles.floatingStatsContainer}>
                {/* Distance (SOL) */}
                <Link href={"/progress"} asChild push>
                  <Pressable style={[styles.statCard, styles.statCardMain]}>
                    <View style={styles.statIconRow}>
                      <Ionicons
                        name="map"
                        size={20}
                        color={COLORS.accent}
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
                            backgroundColor: COLORS.secondary + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name="fitness"
                          size={18}
                          color={COLORS.secondary}
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
                            backgroundColor: COLORS.warning + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name="flame"
                          size={18}
                          color={COLORS.warning}
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
              <View style={styles.sectionContainer}>
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
                      colors={[workoutStyle.color + "22", COLORS.card]}
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
                                backgroundColor: COLORS.success + "18",
                                borderColor: COLORS.success + "40",
                              },
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={COLORS.success}
                            />
                            <Text
                              style={[
                                styles.cornerBadgeText,
                                { color: COLORS.success },
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
                      <Text style={styles.cardWorkoutName} numberOfLines={2}>
                        {todayWorkout.title}
                      </Text>

                      {/* DIVIDER */}
                      <View style={styles.cardDivider} />

                      {/* META ROW */}
                      <View style={styles.cardMetaRow}>
                        <View style={styles.cardMetaItem}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={COLORS.textDim}
                          />
                          <Text style={styles.cardMetaText}>
                            {todayWorkout.planned_duration} dk
                          </Text>
                        </View>
                        {todayWorkout.planned_distance > 0 && (
                          <View style={styles.cardMetaItem}>
                            <Ionicons
                              name="location-outline"
                              size={16}
                              color={COLORS.textDim}
                            />
                            <Text style={styles.cardMetaText}>
                              {todayWorkout.planned_distance} km
                            </Text>
                          </View>
                        )}
                        {todayWorkout.target_pace_seconds && (
                          <View style={styles.cardMetaItem}>
                            <Ionicons
                              name="speedometer-outline"
                              size={16}
                              color={COLORS.textDim}
                            />
                            <Text style={styles.cardMetaText}>
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
                          color={COLORS.cardBorder}
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
                                color={COLORS.white}
                              />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={18}
                                  color={COLORS.white}
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
                        color={COLORS.textDim}
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
              <Link href={"/progress"} asChild push>
                <Pressable>
                  <LinearGradient
                    colors={[COLORS.accent + "20", COLORS.card]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.progressLinkCard}
                  >
                    <View style={styles.progressLinkLeft}>
                      <View style={styles.progressLinkIconWrap}>
                        <Ionicons
                          name="stats-chart"
                          size={22}
                          color={COLORS.accent}
                        />
                      </View>
                      <View>
                        <Text style={styles.progressLinkTitle}>
                          İstatistikleri Görüntüle
                        </Text>
                        <Text style={styles.progressLinkDesc}>
                          Koşu istatistiklerini incele
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.accent}
                    />
                  </LinearGradient>
                </Pressable>
              </Link>
            </>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

// --- STYLING (THEMED) ---
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: COLORS.card,
  },
  heroImage: {
    flex: 1,
    justifyContent: "flex-end",
  },
  heroGradient: {
    height: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  heroTextContainer: {
    marginBottom: 20,
  },
  heroGreeting: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  heroMotivation: {
    color: COLORS.textDim, // Biraz daha yumuşak renk
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    fontStyle: "italic", // Alıntı olduğu için italik güzel durur
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
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  noPlanIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  noPlanTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  noPlanDesc: {
    color: COLORS.textDim,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 24,
  },
  createPlanButtonLarge: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
  },
  createPlanGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  createPlanButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyStatsRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 15,
    width: "100%",
    alignItems: "center",
  },
  emptyStatsText: {
    color: COLORS.inactive,
    fontSize: 14,
    fontWeight: "600",
  },

  // --- ACTIVE STATE ---

  // Floating Stats
  floatingStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statCardMain: {
    flex: 1.2,
    justifyContent: "space-between",
    height: 160,
  },
  statsColumnRight: {
    flex: 1,
    justifyContent: "space-between",
    gap: 12, // DİKEY BOŞLUK
    height: 160,
  },
  statCardSmall: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    justifyContent: "flex-start",
  },
  iconBoxSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statIcon: {
    marginRight: 8,
  },
  statLabelMain: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValueMain: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: "900",
  },
  statUnitMain: {
    fontSize: 18,
    color: COLORS.accent,
    fontWeight: "600",
  },
  statValueSmall: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabelSmall: {
    color: COLORS.textDim,
    fontSize: 12,
  },

  // Section
  sectionContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
    marginLeft: 5,
  },

  emptyWorkoutTicket: {
    backgroundColor: COLORS.cardVariant,
    borderRadius: 22,
    padding: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderStyle: "dashed",
  },
  emptyTicketText: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
  },
  emptyTicketSubText: {
    color: COLORS.inactive,
    fontSize: 13,
    marginTop: 5,
  },

  // Progress Link
  progressLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accent + "30",
    marginTop: 10,
  },
  progressLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressLinkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accent + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLinkTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  progressLinkDesc: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  quickCompleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
  },
  quickCompleteText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  // --- NEW WORKOUT CARD ---
  workoutCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.cardVariant,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textDim,
  },
  cardWorkoutName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 28,
    marginBottom: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardMetaText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  cornerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  cornerBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
