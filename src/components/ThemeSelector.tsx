import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

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

export function ThemeSelector() {
  const { preference, setPreference, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const selected = preference === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => setPreference(opt.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={18}
              color={selected ? colors.accent : colors.text.secondary}
            />
            <Text
              style={[
                styles.optionLabel,
                selected && styles.optionLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
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
    option: {
      flex: 1,
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
