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
  const { getValidToken, user, refreshUserData } = useContext(AuthContext);
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
    const runningDays: number[] = user?.preferred_running_days || [];
    if (runningDays.length === 0) return [];

    const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    const MONTH_NAMES = [
      "Oca", "Şub", "Mar", "Nis", "May", "Haz",
      "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
    ];

    const results: { label: string; date: string }[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1); // Yarından başla

    while (results.length < 4) {
      // preferred_running_days: 0=Pzt, 6=Paz (backend convention)
      const dayOfWeek = (cursor.getDay() + 6) % 7; // JS Sunday=0 → 0=Pzt
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

  // When calendar day is tapped → scroll slider to that workout
  // Double-tap (already selected) → open detail
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
        <View
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
              <Ionicons name="chevron-back" size={22} color={COLORS.accent} />
            </Pressable>
            <Text style={styles.monthTitle}>{currentMonthLabel}</Text>
            <Pressable
              onPress={() => changeMonth(1)}
              hitSlop={12}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={22} color={COLORS.accent} />
            </Pressable>
          </View>

          <Calendar
            key={currentMonth}
            current={currentMonth}
            enableSwipeMonths={false}
            hideArrows={true}
            renderHeader={() => null}
            firstDay={1}
            hideExtraDays={true}
            dayComponent={renderCustomDay as any}
            onMonthChange={(date: any) => setCurrentMonth(date.dateString)}
            theme={{
              calendarBackground: "transparent",
              textSectionTitleColor: "#777",
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
                  color={COLORS.warning}
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
              color={COLORS.textDim}
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
                  color={COLORS.accent}
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
                    color={COLORS.danger}
                  />
                  <Text style={styles.missedToggleText}>
                    {missedWorkouts.length} kaçırılan antrenmanı gör
                  </Text>
                  <Ionicons
                    name={showMissedList ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={COLORS.textDim}
                  />
                </Pressable>
                {showMissedList && (
                  <View style={styles.missedList}>
                    {missedWorkouts.map((w: any) => {
                      const theme = getWorkoutTheme(w.workout_type);
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
                color={COLORS.warning}
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
                        ? COLORS.accent
                        : COLORS.textDim
                    }
                  />
                  <Text
                    style={[
                      styles.modalDateText,
                      selectedRescheduleDate === day.date && {
                        color: COLORS.accent,
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
                <ActivityIndicator color="#fff" size="small" />
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
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  monthTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
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

  // RESCHEDULE INLINE SECTION
  rescheduleSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
  },
  rescheduleSectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rescheduleSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.warning}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  rescheduleSectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  rescheduleSectionDesc: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },

  // RESCHEDULE MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  modalDesc: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  modalWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: COLORS.warning + "12",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  modalWarningText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  modalRemainingText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  modalDates: {
    gap: 8,
    marginBottom: 8,
  },
  modalDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.cardVariant,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalDateButtonSelected: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}15`,
  },
  modalConfirmButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  modalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  modalDateText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  missedSection: {
    marginBottom: 8,
  },
  missedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.cardVariant,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  missedToggleText: {
    flex: 1,
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  missedList: {
    marginTop: 6,
    gap: 4,
  },
  missedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardVariant,
    borderRadius: 10,
  },
  missedItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  missedItemDate: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  missedItemType: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "500",
    marginLeft: "auto" as const,
  },
  modalDismiss: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  modalDismissText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
});
