import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");
const CELL_WIDTH = (width - 40) / 7;
const SLIDER_CARD_WIDTH = width * 0.82;
const SLIDER_CARD_MARGIN = 6;
const SLIDER_ITEM_WIDTH = SLIDER_CARD_WIDTH + SLIDER_CARD_MARGIN * 2;
const SLIDER_PADDING = (width - SLIDER_CARD_WIDTH) / 2 - SLIDER_CARD_MARGIN;

// --- LOCALE SETUP ---
LocaleConfig.locales["tr"] = {
  monthNames: [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ],
  monthNamesShort: [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ],
  dayNames: [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

// --- RENK PALETİ ---
const THEME_COLORS = {
  tempo: "#FF4501",
  easy: "#4ECDC4",
  interval: "#FFD93D",
  long: "#A569BD",
  rest: "#B0A89E",
  default: "#FA7D09",
  missed: "#FF3B30",
};

type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

const getWorkoutTheme = (type: WorkoutTypeEnum) => {
  switch (type) {
    case "tempo":
      return {
        color: THEME_COLORS.tempo,
        name: "Tempo",
        icon: "speedometer",
        bgGradient: [THEME_COLORS.tempo + "65", COLORS.card],
      };
    case "easy":
      return {
        color: THEME_COLORS.easy,
        name: "Hafif",
        icon: "leaf",
        bgGradient: [THEME_COLORS.easy + "65", COLORS.card],
      };
    case "interval":
      return {
        color: THEME_COLORS.interval,
        name: "İnterval",
        icon: "flash",
        bgGradient: [THEME_COLORS.interval + "65", COLORS.card],
      };
    case "long":
      return {
        color: THEME_COLORS.long,
        name: "Uzun",
        icon: "infinite",
        bgGradient: [THEME_COLORS.long + "65", COLORS.card],
      };
    case "rest":
      return {
        color: THEME_COLORS.rest,
        name: "Dinlenme",
        icon: "moon",
        bgGradient: [COLORS.cardVariant, COLORS.card],
      };
    default:
      return {
        color: THEME_COLORS.default,
        name: "Koşu",
        icon: "fitness",
        bgGradient: [THEME_COLORS.default + "50", COLORS.card],
      };
  }
};

const CalendarScreen = () => {
  const { getValidToken } = useContext(AuthContext);
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const sliderRef = useRef<FlatList>(null);
  const isSliderScrolling = useRef(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(
    params.initialDate ? (params.initialDate as string) : todayStr,
  );
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [workoutsMap, setWorkoutsMap] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(todayStr);

  // Sorted workouts for slider (by date) — memoized to prevent re-renders
  const sortedWorkouts = React.useMemo(
    () =>
      [...allWorkouts].sort((a, b) =>
        a.scheduled_date.localeCompare(b.scheduled_date),
      ),
    [allWorkouts],
  );

  useEffect(() => {
    if (params.initialDate) {
      const date = params.initialDate as string;
      setSelectedDate(date);
      setCurrentMonth(date);
    }
  }, [params.initialDate]);

  useEffect(() => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      const unsubscribe = (parentNav as any).addListener("tabPress", () => {
        const today = new Date().toISOString().split("T")[0];
        setSelectedDate(today);
        setCurrentMonth(today);
      });
      return unsubscribe;
    }
  }, [navigation]);

  const fetchWorkouts = async () => {
    const validToken = await getValidToken();
    if (!validToken) return;
    try {
      const response = await fetch(`${API_URL}/workouts/?only_active=true`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      if (response.ok) {
        const json = await response.json();
        const data = Array.isArray(json) ? json : json.results || [];
        setAllWorkouts(data);
        const map: any = {};
        data.forEach((w: any) => {
          if (!map[w.scheduled_date]) map[w.scheduled_date] = w;
        });
        setWorkoutsMap(map);
      }
    } catch (error) {
      console.log("Fetch Error:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWorkouts();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkouts();
    setRefreshing(false);
  };

  // --- TWO-WAY SYNC ---

  // When calendar day is tapped → scroll slider to that workout
  const handleDayPress = (dateStr: string) => {
    setSelectedDate(dateStr);

    const idx = sortedWorkouts.findIndex((w) => w.scheduled_date === dateStr);
    if (idx >= 0 && sliderRef.current) {
      isSliderScrolling.current = true;
      sliderRef.current.scrollToOffset({
        offset: idx * SLIDER_ITEM_WIDTH,
        animated: true,
      });
      setTimeout(() => {
        isSliderScrolling.current = false;
      }, 500);
    }
  };

  // When slider card becomes visible → update selected date & calendar month
  const onSliderViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (isSliderScrolling.current) return;
    if (viewableItems.length > 0) {
      const workout = viewableItems[0].item;
      setSelectedDate(workout.scheduled_date);
      setCurrentMonth(workout.scheduled_date);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  // Scroll slider to selected date on initial load
  useEffect(() => {
    if (sortedWorkouts.length > 0) {
      const idx = sortedWorkouts.findIndex(
        (w) => w.scheduled_date === selectedDate,
      );
      // Find closest workout if no exact match
      const targetIdx = idx >= 0 ? idx : findClosestWorkoutIndex(selectedDate);
      if (targetIdx >= 0 && sliderRef.current) {
        setTimeout(() => {
          sliderRef.current?.scrollToOffset({
            offset: targetIdx * SLIDER_ITEM_WIDTH,
            animated: false,
          });
        }, 300);
      }
    }
  }, [sortedWorkouts.length]);

  const findClosestWorkoutIndex = (date: string) => {
    if (sortedWorkouts.length === 0) return -1;
    let closest = 0;
    let minDiff = Infinity;
    sortedWorkouts.forEach((w, i) => {
      const diff = Math.abs(
        new Date(w.scheduled_date).getTime() - new Date(date).getTime(),
      );
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    });
    return closest;
  };

  // --- SLIDER CARD ---
  const renderSliderCard = useCallback(
    ({ item: workout }: { item: any }) => {
      const theme = getWorkoutTheme(workout.workout_type);
      const isSelected = workout.scheduled_date === selectedDate;

      const dateObj = new Date(workout.scheduled_date);
      const dayName = dateObj.toLocaleDateString("tr-TR", { weekday: "short" });
      const dayNum = dateObj.getDate();
      const monthName = dateObj.toLocaleDateString("tr-TR", { month: "short" });
      const isToday = workout.scheduled_date === todayStr;

      return (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/calendar/workout-detail",
              params: { workoutId: workout.id },
            })
          }
          style={({ pressed }) => [
            styles.sliderCard,
            isSelected && styles.sliderCardSelected,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={theme.bgGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sliderCardGradient}
          >
            {/* Left: Date column */}
            <View style={styles.sliderDateCol}>
              <Text
                style={[
                  styles.sliderDayName,
                  isToday && { color: COLORS.accent },
                ]}
              >
                {isToday ? "Bugün" : dayName}
              </Text>
              <Text style={[styles.sliderDayNum, { color: theme.color }]}>
                {dayNum}
              </Text>
              <Text style={styles.sliderMonth}>{monthName}</Text>
            </View>

            {/* Vertical separator */}
            <View
              style={[
                styles.sliderSeparator,
                { backgroundColor: theme.color + "40" },
              ]}
            />

            {/* Right: Workout info */}
            <View style={styles.sliderInfo}>
              <View style={styles.sliderTopRow}>
                <View
                  style={[
                    styles.sliderTypeBadge,
                    { backgroundColor: theme.color + "25" },
                  ]}
                >
                  <Ionicons
                    name={theme.icon as any}
                    size={14}
                    color={theme.color}
                  />
                  <Text style={[styles.sliderTypeText, { color: theme.color }]}>
                    {theme.name}
                  </Text>
                </View>
              </View>

              <Text style={styles.sliderTitle} numberOfLines={1}>
                {workout.title}
              </Text>

              {workout.workout_type !== "rest" && (
                <View style={styles.sliderMeta}>
                  {workout.planned_duration > 0 && (
                    <View style={styles.sliderMetaItem}>
                      <Ionicons
                        name="timer-outline"
                        size={13}
                        color={COLORS.textDim}
                      />
                      <Text style={styles.sliderMetaText}>
                        {workout.planned_duration} dk
                      </Text>
                    </View>
                  )}
                  {workout.planned_distance > 0 && (
                    <View style={styles.sliderMetaItem}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={COLORS.textDim}
                      />
                      <Text style={styles.sliderMetaText}>
                        {workout.planned_distance} km
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
          </LinearGradient>
        </Pressable>
      );
    },
    [selectedDate, todayStr],
  );

  // --- CALENDAR DAY ---
  const renderCustomDay = ({
    date,
    state,
  }: {
    date: DateData;
    state: string;
  }) => {
    const dateStr = date.dateString;
    const workout = workoutsMap[dateStr];
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;
    const isCurrentMonth = state === "";

    const theme = workout ? getWorkoutTheme(workout.workout_type) : null;
    const isCompleted = workout?.status === "completed";
    const isMissed = workout?.status === "missed";

    return (
      <Pressable
        onPress={() => handleDayPress(dateStr)}
        style={[styles.dayContainer]}
      >
        <View
          style={[
            styles.dayBox,
            // Default: empty day
            !workout && {
              backgroundColor: "#1C1C1C",
              borderColor: isSelected ? COLORS.text : "transparent",
              borderWidth: isSelected ? 1.5 : 0,
              ...(isSelected && { backgroundColor: "#2E2E2E" }),
            },
            // Workout day: use theme color
            workout && {
              borderColor: theme?.color,
              borderWidth: 1.5,
              backgroundColor: theme ? theme.color + "38" : "transparent",
            },
            // Selected day with workout: brighter bg + thicker border
            isSelected &&
              workout && {
                backgroundColor: theme ? theme.color + "99" : "transparent",
                borderWidth: 2,
              },
            // Today without workout: no special border
            isToday &&
              !workout && {
                borderColor: "transparent",
                borderWidth: 0,
              },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: isToday
                  ? COLORS.accent
                  : workout
                    ? COLORS.white
                    : isSelected
                      ? COLORS.text
                      : "#AAA",
                fontWeight: workout || isToday || isSelected ? "800" : "500",
              },
            ]}
          >
            {date.day}
          </Text>

          {/* Small colored dot for workout type */}
          {workout && !isCompleted && !isMissed && (
            <View style={[styles.dayDot, { backgroundColor: theme?.color }]} />
          )}

          {/* Status icons */}
          {isCompleted && (
            <View style={styles.statusIcon}>
              <Ionicons
                name="checkmark-circle"
                size={12}
                color={COLORS.success}
              />
            </View>
          )}
          {isMissed && (
            <View style={styles.statusIcon}>
              <Ionicons
                name="close-circle"
                size={12}
                color={THEME_COLORS.missed}
              />
            </View>
          )}

          {/* Today underline */}
          {isToday && <View style={styles.todayBar} />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Takvim</Text>
        <View style={styles.headerStats}>
          <Ionicons name="fitness-outline" size={14} color={COLORS.accent} />
          <Text style={styles.headerStatsText}>
            {allWorkouts.filter((w) => w.status === "completed").length}/
            {allWorkouts.length}
          </Text>
        </View>
      </View>

      {/* WORKOUT SLIDER */}
      {sortedWorkouts.length > 0 ? (
        <View style={styles.sliderSection}>
          <FlatList
            ref={sliderRef}
            data={sortedWorkouts}
            renderItem={renderSliderCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SLIDER_ITEM_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SLIDER_PADDING }}
            onViewableItemsChanged={onSliderViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={() => {
              isSliderScrolling.current = false;
            }}
            getItemLayout={(_, index) => ({
              length: SLIDER_ITEM_WIDTH,
              offset: SLIDER_ITEM_WIDTH * index,
              index,
            })}
          />
        </View>
      ) : (
        <View style={styles.emptySlider}>
          <Ionicons
            name="calendar-clear-outline"
            size={24}
            color={COLORS.textDim}
          />
          <Text style={styles.emptySliderText}>Henüz antrenman yok</Text>
        </View>
      )}

      {/* CALENDAR */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        <View style={styles.calendarContainer}>
          <Calendar
            key={currentMonth}
            current={currentMonth}
            enableSwipeMonths={true}
            firstDay={1}
            hideExtraDays={true}
            dayComponent={renderCustomDay as any}
            onMonthChange={(date: any) => setCurrentMonth(date.dateString)}
            theme={{
              calendarBackground: "transparent",
              textSectionTitleColor: "#777",
              monthTextColor: COLORS.text,
              textMonthFontSize: 18,
              textMonthFontWeight: "700" as const,
              textDayHeaderFontSize: 12,
              textDayHeaderFontWeight: "600" as const,
              arrowColor: COLORS.accent,
              ["stylesheet.calendar.header" as any]: {
                header: {
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingLeft: 10,
                  paddingRight: 10,
                  marginBottom: 14,
                  alignItems: "center",
                },
                week: {
                  flexDirection: "row",
                  justifyContent: "space-around",
                  paddingBottom: 8,
                  marginBottom: 4,
                  borderBottomWidth: 0,
                },
              },
            }}
          />
        </View>

        {/* LEGEND */}
        <View style={styles.legend}>
          {(
            ["easy", "tempo", "interval", "long", "rest"] as WorkoutTypeEnum[]
          ).map((type) => {
            const theme = getWorkoutTheme(type);
            return (
              <View key={type} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: theme.color }]}
                />
                <Text style={styles.legendText}>{theme.name}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

export default CalendarScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // HEADER
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 5,
  },
  headerStatsText: { color: COLORS.textDim, fontSize: 13, fontWeight: "700" },

  // SLIDER
  sliderSection: {
    marginTop: 10,
    marginBottom: 30,
  },
  sliderCard: {
    width: SLIDER_CARD_WIDTH,
    marginHorizontal: SLIDER_CARD_MARGIN,
    borderRadius: 20,
    overflow: "hidden",
  },
  sliderCardSelected: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sliderCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sliderDateCol: {
    alignItems: "center",
    width: 56,
  },
  sliderDayName: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sliderDayNum: {
    fontSize: 28,
    fontWeight: "900",
  },
  sliderMonth: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  sliderSeparator: {
    width: 1,
    height: 48,
    marginHorizontal: 14,
    borderRadius: 1,
  },
  sliderInfo: {
    flex: 1,
  },
  sliderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  sliderTypeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sliderTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  sliderMeta: {
    flexDirection: "row",
    gap: 12,
  },
  sliderMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sliderMetaText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },

  // EMPTY SLIDER
  emptySlider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderStyle: "dashed",
  },
  emptySliderText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },

  // CALENDAR
  calendarContainer: { marginHorizontal: 10, paddingVertical: 4 },
  dayContainer: {
    width: CELL_WIDTH,
    height: CELL_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 3,
  },
  dayBox: {
    width: CELL_WIDTH - 6,
    height: CELL_WIDTH - 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  dayText: { fontSize: 13 },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  statusIcon: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 1,
    zIndex: 2,
  },
  todayBar: {
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: 3,
  },

  // LEGEND
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "600",
  },
});
