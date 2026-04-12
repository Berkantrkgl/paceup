import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useTheme, type ThemePreference } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";

type Option = {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Option[] = [
  { value: "system", label: "Sistem", icon: "phone-portrait-outline" },
  { value: "light", label: "Aydınlık", icon: "sunny-outline" },
  { value: "dark", label: "Karanlık", icon: "moon-outline" },
];

type ThemeOptionButtonProps = {
  option: Option;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  accent: string;
  inactive: string;
};

function ThemeOptionButton({
  option,
  selected,
  onPress,
  styles,
  accent,
  inactive,
}: ThemeOptionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();

  const handlePressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();

  return (
    <Animated.View style={[styles.optionWrapper, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.option, selected && styles.optionSelected]}
      >
        <Ionicons
          name={option.icon}
          size={18}
          color={selected ? accent : inactive}
        />
        <Text
          style={[styles.optionLabel, selected && styles.optionLabelSelected]}
        >
          {option.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ThemeSelector() {
  const { preference, setPreference, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => (
        <ThemeOptionButton
          key={opt.value}
          option={opt}
          selected={preference === opt.value}
          onPress={() => setPreference(opt.value)}
          styles={styles}
          accent={colors.accent}
          inactive={colors.text.secondary}
        />
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  ({
    container: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 20,
    },
    optionWrapper: {
      flex: 1,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: "transparent",
    },
    optionSelected: {
      borderColor: t.colors.accent,
      borderWidth: 1.5,
    },
    optionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text.secondary,
    },
    optionLabelSelected: {
      color: t.colors.accent,
    },
  }) as const;
