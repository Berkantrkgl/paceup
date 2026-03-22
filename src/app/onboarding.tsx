import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

const GENDER_OPTIONS = [
  { label: "Erkek", value: "male", icon: "male" as const },
  { label: "Kadın", value: "female", icon: "female" as const },
  { label: "Diğer", value: "other", icon: "person" as const },
];

const STEPS = [
  { key: "genderBirthday", title: "Hakkında" },
  { key: "body", title: "Boy & Kilo" },
  { key: "pace", title: "Ortalama Pace" },
  { key: "maxDistance", title: "Maksimum Koşu Mesafesi" },
  { key: "days", title: "Koşu Günlerin" },
];

const DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const HEIGHT_VALUES = Array.from({ length: 101 }, (_, i) => i + 120); // 120-220 cm
const WEIGHT_VALUES = Array.from({ length: 171 }, (_, i) => i + 30); // 30-200 kg
const DISTANCE_VALUES = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100 km
const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3); // 3-15
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i); // 0-59

const OnboardingScreen = () => {
  const { getValidToken, refreshUserData } = useContext(AuthContext);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [gender, setGender] = useState<string>("");
  const [birthday, setBirthday] = useState(new Date(2000, 0, 1));
  const [heightVal, setHeightVal] = useState(175);
  const [weightVal, setWeightVal] = useState(70);
  const [paceMin, setPaceMin] = useState(6);
  const [paceSec, setPaceSec] = useState(0);
  const [paceUnknown, setPaceUnknown] = useState(false);
  const [maxDistance, setMaxDistance] = useState(5);
  const [maxDistanceUnknown, setMaxDistanceUnknown] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const animateProgress = (step: number) => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      animateProgress(next);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      animateProgress(prev);
    }
  };

  const canProceed = () => {
    switch (STEPS[currentStep].key) {
      case "genderBirthday":
        return gender !== "";
      case "days":
        return selectedDays.length > 0;
      default:
        return true;
    }
  };

  const handleComplete = async () => {
    if (!canProceed()) return;

    setIsSaving(true);
    try {
      const validToken = await getValidToken();
      if (!validToken) return;

      const paceInSeconds = paceUnknown ? 0 : paceMin * 60 + paceSec;
      const dateOfBirth = birthday.toLocaleDateString("en-CA"); // YYYY-MM-DD

      const body: any = {
        gender,
        date_of_birth: dateOfBirth,
        height: heightVal,
        weight: weightVal,
        preferred_running_days: selectedDays,
        is_onboarded: true,
      };

      if (!paceUnknown && paceInSeconds > 0) {
        body.current_pace = paceInSeconds;
      }

      if (!maxDistanceUnknown) {
        body.max_runned_distance = maxDistance;
      }

      const res = await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await refreshUserData();
      } else {
        Alert.alert("Hata", "Bilgiler kaydedilemedi. Lütfen tekrar dene.");
        setIsSaving(false);
      }
    } catch {
      Alert.alert("Hata", "Sunucuya bağlanılamadı.");
      setIsSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort(),
    );
  };

  // --- STEP RENDERERS ---

  const renderGenderBirthday = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionLabel}>Cinsiyet</Text>
      <View style={styles.optionsContainer}>
        {GENDER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.genderCard,
              gender === opt.value && styles.genderCardActive,
            ]}
            onPress={() => setGender(opt.value)}
          >
            <Ionicons
              name={opt.icon}
              size={22}
              color={gender === opt.value ? COLORS.white : COLORS.textDim}
            />
            <Text
              style={[
                styles.genderLabel,
                gender === opt.value && styles.genderLabelActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 32 }]}>Doğum Tarihi</Text>
      <View style={styles.datePickerContainer}>
        <DateTimePicker
          value={birthday}
          mode="date"
          display="spinner"
          locale="tr"
          onChange={(_, date) => date && setBirthday(date)}
          maximumDate={new Date()}
          minimumDate={new Date(1940, 0, 1)}
          textColor={COLORS.text}
          themeVariant="dark"
        />
      </View>
    </View>
  );

  const renderBody = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionLabel}>Boy</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={heightVal}
          onValueChange={(v) => setHeightVal(v)}
          style={{ width: 200, color: "white" }}
          itemStyle={{ color: "white", fontSize: 22 }}
        >
          {HEIGHT_VALUES.map((h) => (
            <Picker.Item key={h} label={`${h} cm`} value={h} />
          ))}
        </Picker>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Kilo</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={weightVal}
          onValueChange={(v) => setWeightVal(v)}
          style={{ width: 200, color: "white" }}
          itemStyle={{ color: "white", fontSize: 22 }}
        >
          {WEIGHT_VALUES.map((w) => (
            <Picker.Item key={w} label={`${w} kg`} value={w} />
          ))}
        </Picker>
      </View>
    </View>
  );

  const renderMaxDistance = () => (
    <View style={styles.stepContent}>
      <Pressable
        style={styles.unknownToggle}
        onPress={() => setMaxDistanceUnknown(!maxDistanceUnknown)}
      >
        <View
          style={[
            styles.unknownCheck,
            maxDistanceUnknown && styles.unknownCheckActive,
          ]}
        >
          {maxDistanceUnknown && (
            <Ionicons name="checkmark" size={14} color="#000" />
          )}
        </View>
        <Text style={styles.unknownToggleText}>Bilmiyorum</Text>
      </Pressable>

      <View
        style={[
          styles.pickerWrapper,
          maxDistanceUnknown && { opacity: 0.3 },
        ]}
        pointerEvents={maxDistanceUnknown ? "none" : "auto"}
      >
        <Picker
          selectedValue={maxDistance}
          onValueChange={(v) => setMaxDistance(v)}
          style={{ width: 200, color: "white" }}
          itemStyle={{ color: "white", fontSize: 22 }}
        >
          {DISTANCE_VALUES.map((d) => (
            <Picker.Item key={d} label={`${d} km`} value={d} />
          ))}
        </Picker>
      </View>
    </View>
  );

  const renderPace = () => (
    <View style={styles.stepContent}>
      <Pressable
        style={styles.unknownToggle}
        onPress={() => setPaceUnknown(!paceUnknown)}
      >
        <View
          style={[
            styles.unknownCheck,
            paceUnknown && styles.unknownCheckActive,
          ]}
        >
          {paceUnknown && (
            <Ionicons name="checkmark" size={14} color="#000" />
          )}
        </View>
        <Text style={styles.unknownToggleText}>Bilmiyorum</Text>
      </Pressable>

      <View
        style={[
          styles.dualPickerContainer,
          paceUnknown && { opacity: 0.3 },
        ]}
        pointerEvents={paceUnknown ? "none" : "auto"}
      >
        <View style={styles.pickerColumn}>
          <Text style={styles.columnLabel}>Dakika</Text>
          <Picker
            selectedValue={paceMin}
            onValueChange={(v) => setPaceMin(v)}
            style={{ width: 100, color: "white" }}
            itemStyle={{ color: "white" }}
          >
            {PACE_MINUTES.map((m) => (
              <Picker.Item key={m} label={m.toString()} value={m} />
            ))}
          </Picker>
        </View>
        <Text style={styles.pickerSeparator}>:</Text>
        <View style={styles.pickerColumn}>
          <Text style={styles.columnLabel}>Saniye</Text>
          <Picker
            selectedValue={paceSec}
            onValueChange={(v) => setPaceSec(v)}
            style={{ width: 100, color: "white" }}
            itemStyle={{ color: "white" }}
          >
            {PACE_SECONDS.map((s) => (
              <Picker.Item
                key={s}
                label={s < 10 ? `0${s}` : s.toString()}
                value={s}
              />
            ))}
          </Picker>
        </View>
        <Text style={styles.pickerUnit}>/km</Text>
      </View>
    </View>
  );

  const renderDays = () => (
    <View style={styles.stepContent}>
      <View style={styles.daysGrid}>
        {DAYS_SHORT.map((day, index) => (
          <Pressable
            key={index}
            style={[
              styles.dayChip,
              selectedDays.includes(index) && styles.dayChipActive,
            ]}
            onPress={() => toggleDay(index)}
          >
            <Text
              style={[
                styles.dayChipText,
                selectedDays.includes(index) && styles.dayChipTextActive,
              ]}
            >
              {day}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.daysHint}>
        {selectedDays.length > 0
          ? `Haftada ${selectedDays.length} gün seçildi`
          : "En az 1 gün seç"}
      </Text>
    </View>
  );

  const renderStep = ({ item }: { item: (typeof STEPS)[0] }) => {
    return (
      <View style={{ width }}>
        <View style={styles.stepInner}>
          <Text style={styles.stepTitle}>{item.title}</Text>

          {item.key === "genderBirthday" && renderGenderBirthday()}
          {item.key === "body" && renderBody()}
          {item.key === "pace" && renderPace()}
          {item.key === "maxDistance" && renderMaxDistance()}
          {item.key === "days" && renderDays()}
        </View>
      </View>
    );
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* PROGRESS BAR */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        {currentStep > 0 ? (
          <Pressable onPress={goBack} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.stepIndicator}>
          {currentStep + 1} / {STEPS.length}
        </Text>
      </View>

      {/* STEPS */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* BOTTOM BUTTON */}
      <View style={styles.bottomContainer}>
        <Pressable
          onPress={isLastStep ? handleComplete : goNext}
          disabled={!canProceed() || isSaving}
          style={({ pressed }) => [
            styles.nextButtonWrapper,
            (!canProceed() || isSaving) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {isLastStep ? "Başlayalım" : "Devam Et"}
                </Text>
                <Ionicons
                  name={isLastStep ? "checkmark-circle" : "arrow-forward"}
                  size={20}
                  color={COLORS.white}
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: StatusBar.currentHeight ?? 60,
  },

  // Progress
  progressBarContainer: {
    height: 3,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 24,
    borderRadius: 2,
    marginTop: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
  },
  stepIndicator: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },

  // Steps
  stepInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
  },
  stepContent: {
    flex: 1,
  },

  // Section label (for combined steps)
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Gender
  optionsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  genderCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  genderCardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + "12",
  },
  genderLabel: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  genderLabelActive: {
    color: COLORS.text,
  },

  // Birthday
  datePickerContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Pickers
  dualPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 8,
  },
  pickerColumn: {
    alignItems: "center",
  },
  columnLabel: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerSeparator: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 20,
  },
  pickerUnit: {
    color: COLORS.textDim,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginLeft: 4,
  },
  pickerWrapper: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: "center",
    paddingVertical: 8,
  },
  unknownToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    marginBottom: 16,
  },
  unknownCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  unknownCheckActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  unknownToggleText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "500",
  },

  // Days
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  dayChip: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  dayChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + "18",
  },
  dayChipText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: COLORS.accent,
  },
  daysHint: {
    color: COLORS.textDim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },

  // Bottom
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  nextButtonWrapper: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "700",
  },
});
