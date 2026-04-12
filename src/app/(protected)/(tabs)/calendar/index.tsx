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
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";

import { CalendarTour } from "@/components/tour/CalendarTour";
import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme, ThemeColors } from "@/theme/tokens";
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

// --- WORKOUT TİP PALETİ ---
// Dark ve light için ayrı paletler — özellikle sarı (interval) ve turkuaz
// (easy) light zeminde kontrast kaybettiği için koyu alternatifler kullanılır.
const WORKOUT_PALETTE = {
  dark: {
    tempo: "#FF4501",
    easy: "#4ECDC4",
    interval: "#FFD93D",
    long: "#A569BD",
    rest: "#B0A89E",
    default: "#FA7D09",
    missed: "#FF3B30",
  },
  light: {
    tempo: "#E23E00", // Biraz koyulaştırılmış
    easy: "#0E9B8F", // Koyu turkuaz — beyaz zeminde okunur
    interval: "#B8860B", // Koyu altın — sarı yerine
    long: "#7B3F96", // Koyu mor
    rest: "#8A8278",
    default: "#D96A00",
    missed: "#E53935",
  },
} as const;

// Geriye dönük uyumluluk için default referans (status icon'larda kullanılıyor)
const THEME_COLORS = WORKOUT_PALETTE.dark;

type WorkoutTypeEnum = "easy" | "tempo" | "interval" | "long" | "rest";

// colors + isDark parametreleri theme-aware bgGradient için gerekli.
// Light modda pure surface'e ölmek yerine color'un kendisine fade olur,
// böylece gradient boyunca renk canlılığı korunur.
const getWorkoutTheme = (
  type: WorkoutTypeEnum,
  c: ThemeColors,
  isDark: boolean,
) => {
  const palette = isDark ? WORKOUT_PALETTE.dark : WORKOUT_PALETTE.light;
  const grad = (color: string): [string, string] =>
    isDark ? [color + "65", c.surface] : [color, color + "A0"];

  switch (type) {
    case "tempo":
      return {
        color: palette.tempo,
        name: "Tempo",
        icon: "speedometer",
        bgGradient: grad(palette.tempo),
      };
    case "easy":
      return {
        color: palette.easy,
        name: "Hafif",
        icon: "leaf",
        bgGradient: grad(palette.easy),
      };
    case "interval":
      return {
        color: palette.interval,
        name: "İnterval",
        icon: "flash",
        bgGradient: grad(palette.interval),
      };
    case "long":
      return {
        color: palette.long,
        name: "Uzun",
        icon: "infinite",
        bgGradient: grad(palette.long),
      };
    case "rest":
      return {
        color: palette.rest,
        name: "Dinlenme",
        icon: "moon",
        bgGradient: isDark
          ? ([c.surfaceVariant, c.surface] as [string, string])
          : ([palette.rest + "55", palette.rest + "1F"] as [string, string]),
      };
    default:
      return {
        color: palette.default,
        name: "Koşu",
        icon: "fitness",
        bgGradient: isDark
          ? ([palette.default + "50", c.surface] as [string, string])
          : ([palette.default + "80", palette.default + "2E"] as [
              string,
              string,
            ]),
      };
  }
};

const CalendarScreen = () => {
  const { getValidToken, user, refreshUserData } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const sliderRef = useRef<FlatList>(null);
  const sliderTourRef = useRef<View>(null);
  const calendarTourRef = useRef<View>(null);
  const isSliderScrolling = useRef(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(
    params.initialDate ? (params.initialDate as string) : todayStr,
  );
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [workoutsMap, setWorkoutsMap] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(todayStr);

  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [missedWorkout, setMissedWorkout] = useState<any>(null);
  const [missedWorkouts, setMissedWorkouts] = useState<any[]>([]);
  const [showMissedList, setShowMissedList] = useState(false);
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState<
    string | null
  >(null);
  const rescheduleChecked = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Calendar library theme prop — temaya bağlı.
  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "transparent",
      textSectionTitleColor: colors.text.secondary,
      textDayHeaderFontSize: 12,
      textDayHeaderFontWeight: "600" as const,
      ["stylesheet.calendar.header" as any]: {
        week: {
          flexDirection: "row",
          justifyContent: "space-around",
          paddingBottom: 8,
          marginBottom: 4,
          borderBottomWidth: 0,
        },
      },
    }),
    [colors],
  );

  const handleTouchStart = (e: any) => {
    touchStart.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    };
  };

  const handleTouchEnd = (e: any) => {
    if (!touchStart.current) return;
    const deltaX = e.nativeEvent.pageX - touchStart.current.x;
    const deltaY = e.nativeEvent.pageY - touchStart.current.y;
    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      changeMonth(deltaX < 0 ? 1 : -1);
    }
    touchStart.current = null;
  };

  const changeMonth = (direction: 1 | -1) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentMonth(newMonth);
  };

  const currentMonthLabel = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const months = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ];
    return `${months[m - 1]} ${y}`;
  })();

  // Sorted workouts for slider (by date) — memoized to prevent re-renders
  const sortedWorkouts = useMemo(
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

        // Missed workout check — her fetch sonrası güncelle
        const today = new Date().toISOString().split("T")[0];
        const pastWorkouts = data
          .filter((w: any) => w.scheduled_date < today)
          .sort((a: any, b: any) =>
            a.scheduled_date.localeCompare(b.scheduled_date),
          );

        if (pastWorkouts.length > 0) {
          const lastPast = pastWorkouts[pastWorkouts.length - 1];
          if (lastPast.status === "missed") {
            // Sondan geriye doğru ardışık missed zincirini bul
            const missed: any[] = [];
            for (let i = pastWorkouts.length - 1; i >= 0; i--) {
              if (pastWorkouts[i].status === "missed") {
                missed.unshift(pastWorkouts[i]);
              } else {
                break;
              }
            }
            setMissedWorkout(lastPast);
            setMissedWorkouts(missed);

            // Popup sadece session'da ilk kez gösterilsin
            if (!rescheduleChecked.current) {
              rescheduleChecked.current = true;
              setSelectedRescheduleDate(null);
              setShowMissedList(false);
              setShowRescheduleModal(true);
            }
          } else {
            // Artık missed yok → temizle
            setMissedWorkout(null);
            setMissedWorkouts([]);
          }
        } else {
          setMissedWorkout(null);
          setMissedWorkouts([]);
        }
      }
    } catch (error) {
      console.log("Fetch Error:", error);
    }
  };

  // --- RESCHEDULE ---
  const getNextRunningDays = (): { label: string; date: string }[] => {
    const daySet = new Set<number>();
    allWorkouts.forEach((w: any) => {
      if (w.workout_type !== "rest") {
        const d = new Date(w.scheduled_date);
        daySet.add((d.getDay() + 6) % 7);
      }
    });
    const runningDays = Array.from(daySet);
    if (runningDays.length === 0) return [];

    const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    const MONTH_NAMES = [
      "Oca", "Şub", "Mar", "Nis", "May", "Haz",
      "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
    ];

    const results: { label: string; date: string }[] = [];
    const today = new Date();

    const todayDow = (today.getDay() + 6) % 7;
    const daysUntilSunday = 6 - todayDow;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysUntilSunday + 7);

    const cursor = new Date(today);
    while (cursor <= endDate) {
      const dayOfWeek = (cursor.getDay() + 6) % 7;
      if (runningDays.includes(dayOfWeek)) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;
        const dayName = DAY_NAMES[dayOfWeek];
        const monthName = MONTH_NAMES[cursor.getMonth()];
        results.push({
          label: `${dayName}, ${cursor.getDate()} ${monthName}`,
          date: dateStr,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  };

  const handleReschedule = async (startDate: string) => {
    if (!missedWorkout) return;
    const programId = missedWorkout.program;
    if (!programId) {
      Alert.alert("Hata", "Aktif program bulunamadı.");
      return;
    }

    setIsRescheduling(true);
    const validToken = await getValidToken();
    try {
      const res = await fetch(
        `${API_URL}/programs/${programId}/reschedule/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${validToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ start_date: startDate }),
        },
      );

      if (res.status === 403) {
        const data = await res.json();
        Alert.alert("Erteleme Hakkı Doldu", data.error);
      } else if (res.ok) {
        setShowRescheduleModal(false);
        await Promise.all([fetchWorkouts(), refreshUserData()]);
        Alert.alert("Başarılı", "Planın güncellendi.");
      } else {
        Alert.alert("Hata", "Erteleme işlemi başarısız oldu.");
      }
    } catch {
      Alert.alert("Hata", "Bağlantı hatası.");
    } finally {
      setIsRescheduling(false);
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

  const handleDayPress = (dateStr: string) => {
    if (dateStr === selectedDate) {
      const workout = workoutsMap[dateStr];
      if (workout) {
        router.push({
          pathname: "/calendar/workout-detail",
          params: { workoutId: workout.id },
        });
      }
      return;
    }

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

  useEffect(() => {
    if (sortedWorkouts.length > 0) {
      const idx = sortedWorkouts.findIndex(
        (w) => w.scheduled_date === selectedDate,
      );
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
      const theme = getWorkoutTheme(workout.workout_type, colors, isDark);
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
                  !isDark && { color: "rgba(255,255,255,0.85)" },
                  isToday && { color: isDark ? colors.accent : colors.white },
                ]}
              >
                {isToday ? "Bugün" : dayName}
              </Text>
              <Text
                style={[
                  styles.sliderDayNum,
                  { color: isDark ? theme.color : colors.white },
                ]}
              >
                {dayNum}
              </Text>
              <Text
                style={[
                  styles.sliderMonth,
                  !isDark && { color: "rgba(255,255,255,0.85)" },
                ]}
              >
                {monthName}
              </Text>
            </View>

            {/* Vertical separator */}
            <View
              style={[
                styles.sliderSeparator,
                {
                  backgroundColor: isDark
                    ? theme.color + "40"
                    : "rgba(255,255,255,0.45)",
                },
              ]}
            />

            {/* Right: Workout info */}
            <View style={styles.sliderInfo}>
              <View style={styles.sliderTopRow}>
                <View
                  style={[
                    styles.sliderTypeBadge,
                    {
                      backgroundColor: isDark
                        ? theme.color + "25"
                        : "rgba(255,255,255,0.28)",
                    },
                  ]}
                >
                  <Ionicons
                    name={theme.icon as any}
                    size={14}
                    color={isDark ? theme.color : colors.white}
                  />
                  <Text
                    style={[
                      styles.sliderTypeText,
                      { color: isDark ? theme.color : colors.white },
                    ]}
                  >
                    {theme.name}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.sliderTitle,
                  !isDark && { color: colors.white },
                ]}
                numberOfLines={1}
              >
                {workout.title}
              </Text>

              {workout.workout_type !== "rest" && (
                <View style={styles.sliderMeta}>
                  {workout.planned_duration > 0 && (
                    <View style={styles.sliderMetaItem}>
                      <Ionicons
                        name="timer-outline"
                        size={13}
                        color={
                          isDark
                            ? colors.text.secondary
                            : "rgba(255,255,255,0.9)"
                        }
                      />
                      <Text
                        style={[
                          styles.sliderMetaText,
                          !isDark && { color: "rgba(255,255,255,0.9)" },
                        ]}
                      >
                        {workout.planned_duration} dk
                      </Text>
                    </View>
                  )}
                  {workout.planned_distance > 0 && (
                    <View style={styles.sliderMetaItem}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={
                          isDark
                            ? colors.text.secondary
                            : "rgba(255,255,255,0.9)"
                        }
                      />
                      <Text
                        style={[
                          styles.sliderMetaText,
                          !isDark && { color: "rgba(255,255,255,0.9)" },
                        ]}
                      >
                        {workout.planned_distance} km
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? colors.text.secondary : "rgba(255,255,255,0.8)"}
            />
          </LinearGradient>
        </Pressable>
      );
    },
    [selectedDate, todayStr, colors, styles],
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

    const theme = workout ? getWorkoutTheme(workout.workout_type, colors, isDark) : null;
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
              backgroundColor: isDark ? colors.surfaceVariant : "#E8DFCB",
              borderColor: isSelected ? colors.text.primary : "transparent",
              borderWidth: isSelected ? 1.5 : 0,
              ...(isSelected && {
                backgroundColor: isDark ? colors.borderStrong : "#C8B99E",
              }),
            },
            // Workout day: use theme color
            workout && {
              borderColor: theme?.color,
              borderWidth: 1.5,
              backgroundColor: theme
                ? theme.color + (isDark ? "38" : "70")
                : "transparent",
            },
            // Selected day with workout: brighter bg + thicker border
            isSelected &&
              workout && {
                backgroundColor: theme
                  ? theme.color + (isDark ? "99" : "D8")
                  : "transparent",
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
                  ? colors.accent
                  : workout
                    ? colors.white
                    : isSelected
                      ? colors.text.primary
                      : colors.text.disabled,
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
                color={colors.success}
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
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Takvim</Text>
        <View style={styles.headerStats}>
          <Ionicons name="fitness-outline" size={14} color={colors.accent} />
          <Text style={styles.headerStatsText}>
            {allWorkouts.filter((w) => w.status === "completed").length}/
            {allWorkouts.length}
          </Text>
        </View>
      </View>

      {/* WORKOUT SLIDER */}
      <View ref={sliderTourRef}>
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
              color={colors.text.secondary}
            />
            <Text style={styles.emptySliderText}>Henüz antrenman yok</Text>
          </View>
        )}
      </View>

      {/* CALENDAR */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View
          ref={calendarTourRef}
          style={styles.calendarContainer}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Custom Month Header */}
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              hitSlop={12}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-back" size={22} color={colors.accent} />
            </Pressable>
            <Text style={styles.monthTitle}>{currentMonthLabel}</Text>
            <Pressable
              onPress={() => changeMonth(1)}
              hitSlop={12}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.accent} />
            </Pressable>
          </View>

          <Calendar
            key={`${currentMonth}-${colors.background}`}
            current={currentMonth}
            enableSwipeMonths={false}
            hideArrows={true}
            renderHeader={() => null}
            firstDay={1}
            hideExtraDays={true}
            dayComponent={renderCustomDay as any}
            onMonthChange={(date: any) => setCurrentMonth(date.dateString)}
            theme={calendarTheme}
          />
        </View>

        {/* LEGEND */}
        <View style={styles.legend}>
          {(
            ["easy", "tempo", "interval", "long", "rest"] as WorkoutTypeEnum[]
          ).map((type) => {
            const theme = getWorkoutTheme(type, colors, isDark);
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

        {/* RESCHEDULE INLINE SECTION */}
        {missedWorkout && (
          <Pressable
            style={styles.rescheduleSection}
            onPress={() => {
              setSelectedRescheduleDate(null);
              setShowMissedList(false);
              setShowRescheduleModal(true);
            }}
          >
            <View style={styles.rescheduleSectionLeft}>
              <View style={styles.rescheduleSectionIcon}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={colors.warning}
                />
              </View>
              <View>
                <Text style={styles.rescheduleSectionTitle}>
                  {missedWorkouts.length > 1
                    ? `${missedWorkouts.length} kaçırılan antrenman`
                    : "Kaçırılan antrenman"}
                </Text>
                <Text style={styles.rescheduleSectionDesc}>
                  Planını kaydırmak için dokun
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.secondary}
            />
          </Pressable>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ========== RESCHEDULE MODAL ========== */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24 }}
            >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <Ionicons
                  name="calendar-outline"
                  size={28}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle}>
                {missedWorkouts.length > 1
                  ? `${missedWorkouts.length} Kaçırılan Antrenman`
                  : "Kaçırılan Antrenman"}
              </Text>
              <Text style={styles.modalDesc}>
                Kaçırdığın antrenmanları ileri bir koşu gününe kaydırmak ister
                misin?
              </Text>
            </View>

            {/* Collapsible missed workouts list */}
            {missedWorkouts.length > 0 && (
              <View style={styles.missedSection}>
                <Pressable
                  style={styles.missedToggle}
                  onPress={() => {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    );
                    setShowMissedList(!showMissedList);
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.danger}
                  />
                  <Text style={styles.missedToggleText}>
                    {missedWorkouts.length} kaçırılan antrenmanı gör
                  </Text>
                  <Ionicons
                    name={showMissedList ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.text.secondary}
                  />
                </Pressable>
                {showMissedList && (
                  <View style={styles.missedList}>
                    {missedWorkouts.map((w: any) => {
                      const theme = getWorkoutTheme(w.workout_type, colors, isDark);
                      const d = new Date(w.scheduled_date + "T00:00:00");
                      const dayName = d.toLocaleDateString("tr-TR", {
                        weekday: "short",
                      });
                      const dayNum = d.getDate();
                      const month = d.toLocaleDateString("tr-TR", {
                        month: "short",
                      });
                      return (
                        <View key={w.id} style={styles.missedItem}>
                          <View
                            style={[
                              styles.missedItemDot,
                              { backgroundColor: theme.color },
                            ]}
                          />
                          <Text style={styles.missedItemDate}>
                            {dayName}, {dayNum} {month}
                          </Text>
                          <Text style={styles.missedItemType}>
                            {theme.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Warning */}
            <View style={styles.modalWarning}>
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.warning}
              />
              <Text style={styles.modalWarningText}>
                Bu işlem tüm antrenmanları yeniden sıralayacak. Uzun koşu
                günlerin değişebilir.
              </Text>
            </View>

            {/* Remaining reschedules */}
            {user && !user.is_premium && (
              <Text style={styles.modalRemainingText}>
                Kalan erteleme hakkı: {user.remaining_reschedules}/2
              </Text>
            )}

            {/* Date options */}
            <View style={styles.modalDates}>
              {getNextRunningDays().map((day) => (
                <Pressable
                  key={day.date}
                  style={({ pressed }) => [
                    styles.modalDateButton,
                    selectedRescheduleDate === day.date &&
                      styles.modalDateButtonSelected,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => setSelectedRescheduleDate(day.date)}
                  disabled={isRescheduling}
                >
                  <Ionicons
                    name={
                      selectedRescheduleDate === day.date
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={20}
                    color={
                      selectedRescheduleDate === day.date
                        ? colors.accent
                        : colors.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.modalDateText,
                      selectedRescheduleDate === day.date && {
                        color: colors.accent,
                      },
                    ]}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Confirm button */}
            <Pressable
              style={({ pressed }) => [
                styles.modalConfirmButton,
                !selectedRescheduleDate && styles.modalConfirmButtonDisabled,
                pressed &&
                  selectedRescheduleDate && {
                    opacity: 0.8,
                    transform: [{ scale: 0.97 }],
                  },
              ]}
              onPress={() => {
                if (selectedRescheduleDate) {
                  handleReschedule(selectedRescheduleDate);
                }
              }}
              disabled={!selectedRescheduleDate || isRescheduling}
            >
              {isRescheduling ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Ertele</Text>
              )}
            </Pressable>

            {/* Dismiss */}
            <Pressable
              style={styles.modalDismiss}
              onPress={() => {
                setSelectedRescheduleDate(null);
                setShowRescheduleModal(false);
              }}
            >
              <Text style={styles.modalDismissText}>Şimdilik Geç</Text>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CalendarTour
        highlightRefs={{
          slider: sliderTourRef,
          calendar: calendarTourRef,
        }}
      />
    </View>
  );
};

export default CalendarScreen;

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: { flex: 1, backgroundColor: c.background },

    // HEADER
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 20,
      paddingTop: 70,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "900" as const,
      color: c.text.primary,
      letterSpacing: 0.3,
    },
    headerStats: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surface,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 5,
    },
    headerStatsText: {
      color: c.text.secondary,
      fontSize: 13,
      fontWeight: "700" as const,
    },

    // SLIDER
    sliderSection: {
      marginTop: 10,
      marginBottom: 30,
    },
    sliderCard: {
      width: SLIDER_CARD_WIDTH,
      marginHorizontal: SLIDER_CARD_MARGIN,
      borderRadius: 20,
      overflow: "hidden" as const,
    },
    sliderCardSelected: {
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    sliderCardGradient: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    sliderDateCol: {
      alignItems: "center" as const,
      width: 56,
    },
    sliderDayName: {
      color: c.text.secondary,
      fontSize: 12,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      marginBottom: 2,
    },
    sliderDayNum: {
      fontSize: 28,
      fontWeight: "900" as const,
    },
    sliderMonth: {
      color: c.text.secondary,
      fontSize: 12,
      fontWeight: "600" as const,
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
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: 4,
    },
    sliderTypeBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 4,
    },
    sliderTypeText: {
      fontSize: 12,
      fontWeight: "700" as const,
      textTransform: "uppercase" as const,
    },
    sliderTitle: {
      color: c.text.primary,
      fontSize: 16,
      fontWeight: "700" as const,
      marginBottom: 6,
    },
    sliderMeta: {
      flexDirection: "row" as const,
      gap: 12,
    },
    sliderMetaItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 3,
    },
    sliderMetaText: {
      color: c.text.secondary,
      fontSize: 13,
      fontWeight: "600" as const,
    },

    // EMPTY SLIDER
    emptySlider: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 8,
      paddingVertical: 20,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: "dashed" as const,
    },
    emptySliderText: {
      color: c.text.secondary,
      fontSize: 14,
      fontWeight: "600" as const,
    },

    // CALENDAR
    calendarContainer: { marginHorizontal: 10, paddingVertical: 4 },
    monthHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 10,
      marginBottom: 14,
    },
    monthTitle: {
      color: c.text.primary,
      fontSize: 18,
      fontWeight: "700" as const,
    },
    monthArrow: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
    },
    dayContainer: {
      width: CELL_WIDTH,
      height: CELL_WIDTH,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginVertical: 3,
    },
    dayBox: {
      width: CELL_WIDTH - 6,
      height: CELL_WIDTH - 6,
      justifyContent: "center" as const,
      alignItems: "center" as const,
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
      position: "absolute" as const,
      top: -4,
      right: -4,
      backgroundColor: c.background,
      borderRadius: 8,
      padding: 1,
      zIndex: 2,
    },
    todayBar: {
      width: 14,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: c.accent,
      marginTop: 3,
    },

    // LEGEND
    legend: {
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      flexWrap: "wrap" as const,
      gap: 14,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    legendItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      color: c.text.secondary,
      fontSize: 11,
      fontWeight: "600" as const,
    },

    // RESCHEDULE INLINE SECTION
    rescheduleSection: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginHorizontal: 20,
      marginTop: 20,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: `${c.warning}30`,
    },
    rescheduleSectionLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      flex: 1,
    },
    rescheduleSectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${c.warning}15`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    rescheduleSectionTitle: {
      color: c.text.primary,
      fontSize: 14,
      fontWeight: "700" as const,
    },
    rescheduleSectionDesc: {
      color: c.text.secondary,
      fontSize: 12,
      fontWeight: "500" as const,
      marginTop: 2,
    },

    // RESCHEDULE MODAL
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingHorizontal: 24,
    },
    modalContainer: {
      width: "100%" as const,
      maxHeight: "80%" as const,
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden" as const,
    },
    modalHeader: {
      alignItems: "center" as const,
      marginBottom: 16,
    },
    modalIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent + "18",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 14,
    },
    modalTitle: {
      color: c.text.primary,
      fontSize: 20,
      fontWeight: "800" as const,
      marginBottom: 6,
      textAlign: "center" as const,
    },
    modalDesc: {
      color: c.text.secondary,
      fontSize: 14,
      textAlign: "center" as const,
      lineHeight: 20,
    },
    modalWarning: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: 8,
      backgroundColor: c.warning + "12",
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    modalWarningText: {
      color: c.warning,
      fontSize: 12,
      fontWeight: "600" as const,
      flex: 1,
      lineHeight: 18,
    },
    modalRemainingText: {
      color: c.text.secondary,
      fontSize: 12,
      fontWeight: "600" as const,
      textAlign: "center" as const,
      marginBottom: 12,
    },
    modalDates: {
      gap: 8,
      marginBottom: 8,
    },
    modalDateButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      backgroundColor: c.surfaceVariant,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalDateButtonSelected: {
      borderColor: c.accent,
      backgroundColor: `${c.accent}15`,
    },
    modalConfirmButton: {
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: 4,
      marginBottom: 4,
    },
    modalConfirmButtonDisabled: {
      opacity: 0.4,
    },
    modalConfirmText: {
      color: c.text.inverse,
      fontSize: 16,
      fontWeight: "800" as const,
    },
    modalDateText: {
      color: c.text.primary,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    missedSection: {
      marginBottom: 8,
    },
    missedToggle: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      backgroundColor: c.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    missedToggleText: {
      flex: 1,
      color: c.text.secondary,
      fontSize: 13,
      fontWeight: "600" as const,
    },
    missedList: {
      marginTop: 6,
      gap: 4,
    },
    missedItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: c.surfaceVariant,
      borderRadius: 10,
    },
    missedItemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    missedItemDate: {
      color: c.text.primary,
      fontSize: 13,
      fontWeight: "600" as const,
    },
    missedItemType: {
      color: c.text.secondary,
      fontSize: 12,
      fontWeight: "500" as const,
      marginLeft: "auto" as const,
    },
    modalDismiss: {
      alignItems: "center" as const,
      paddingVertical: 14,
      marginTop: 4,
    },
    modalDismissText: {
      color: c.text.secondary,
      fontSize: 14,
      fontWeight: "600" as const,
    },
  } as const;
};
