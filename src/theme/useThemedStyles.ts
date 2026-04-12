import { useMemo } from "react";
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme } from "./ThemeContext";
import type { Theme } from "./tokens";

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

/**
 * Tema-bilinçli StyleSheet factory hook.
 *
 * Kullanım (component dosyasının en altında):
 *
 *   const makeStyles = (t: Theme) => ({
 *     container: { backgroundColor: t.colors.background },
 *     card:      { backgroundColor: t.colors.surface },
 *   } as const);
 *
 * Component içinde:
 *
 *   const styles = useThemedStyles(makeStyles);
 *
 * `makeStyles` component dışında tanımlanmalıdır — böylece referansı stabil
 * kalır ve useMemo yalnızca theme değiştiğinde yeniden hesaplar.
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T
): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}
