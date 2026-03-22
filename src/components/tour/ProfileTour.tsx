import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  LayoutRectangle,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

const { width: SW, height: SH } = Dimensions.get("window");
const TAB_BAR_H = Platform.OS === "ios" ? 96 : 72;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type TourStep = {
  text: string;
  target: "premium" | "identity" | null;
};

const STEPS: TourStep[] = [
  {
    text: "Premium'a geçerek sınırsız AI kullanımı\nve tüm özelliklerin kilidini açabilirsin.",
    target: "premium",
  },
  {
    text: "Buradan kişisel bilgilerini ve\ntercihlerini güncelleyebilirsin.",
    target: "identity",
  },
];

interface ProfileTourProps {
  highlightRefs: {
    premium: React.RefObject<View | null>;
    identity: React.RefObject<View | null>;
  };
}

export const ProfileTour = ({ highlightRefs }: ProfileTourProps) => {
  const { user, getValidToken, refreshUserData } = useContext(AuthContext);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<LayoutRectangle | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  const spotX = useRef(new Animated.Value(0)).current;
  const spotY = useRef(new Animated.Value(0)).current;
  const spotW = useRef(new Animated.Value(0)).current;
  const spotH = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user && user.is_onboarded && user.tour_profile === false) {
      const timer = setTimeout(() => {
        setVisible(true);
        measureAndShow(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
        animateText();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [user?.tour_profile]);

  const animateText = () => {
    textAnim.setValue(0);
    Animated.spring(textAnim, {
      toValue: 1,
      tension: 50,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const measure = useCallback(
    (ref: React.RefObject<View | null>): Promise<LayoutRectangle | null> =>
      new Promise((resolve) => {
        if (!ref.current) return resolve(null);
        ref.current.measureInWindow((x, y, w, h) => {
          if (w === 0 && h === 0) resolve(null);
          else resolve({ x, y, width: w, height: h });
        });
      }),
    [],
  );

  const measureAndShow = async (stepIndex: number) => {
    const target = STEPS[stepIndex].target;
    const ref = target ? highlightRefs[target] : null;

    if (ref) {
      const measured = await measure(ref);
      if (measured) {
        setRect(measured);
        const PAD = 10;
        spotX.setValue(measured.x - PAD);
        spotY.setValue(measured.y - PAD);
        spotW.setValue(measured.width + PAD * 2);
        spotH.setValue(measured.height + PAD * 2);
      }
    }
  };

  const goToStep = async (nextStep: number) => {
    Animated.timing(textAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(async () => {
      setStep(nextStep);
      const target = STEPS[nextStep].target;
      const ref = target ? highlightRefs[target] : null;

      if (ref) {
        const measured = await measure(ref);
        if (measured) {
          setRect(measured);
          const PAD = 10;
          Animated.parallel([
            Animated.spring(spotX, { toValue: measured.x - PAD, useNativeDriver: false, tension: 60, friction: 10 }),
            Animated.spring(spotY, { toValue: measured.y - PAD, useNativeDriver: false, tension: 60, friction: 10 }),
            Animated.spring(spotW, { toValue: measured.width + PAD * 2, useNativeDriver: false, tension: 60, friction: 10 }),
            Animated.spring(spotH, { toValue: measured.height + PAD * 2, useNativeDriver: false, tension: 60, friction: 10 }),
          ]).start();
        }
      } else {
        setRect(null);
        Animated.parallel([
          Animated.timing(spotW, { toValue: 0, duration: 200, useNativeDriver: false }),
          Animated.timing(spotH, { toValue: 0, duration: 200, useNativeDriver: false }),
        ]).start();
      }
      animateText();
    });
  };

  const handleTap = () => {
    if (step < STEPS.length - 1) {
      goToStep(step + 1);
    } else {
      completeTour();
    }
  };

  const completeTour = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setVisible(false));

    try {
      const validToken = await getValidToken();
      if (validToken) {
        await fetch(`${API_URL}/users/me/`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${validToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tour_profile: true }),
        });
        await refreshUserData();
      }
    } catch (e) {
      console.log("[ProfileTour] error:", e);
    }
  };

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const TEXT_H = 100;
  const GAP = 20;

  const getTextPosition = (): { top?: number; bottom?: number } => {
    if (!rect) return { top: SH * 0.38 };

    const spaceBelow = SH - TAB_BAR_H - (rect.y + rect.height + GAP);

    if (spaceBelow >= TEXT_H) {
      return { top: rect.y + rect.height + GAP };
    }
    return { top: Math.max(rect.y - GAP - TEXT_H, 50) };
  };

  const textPos = getTextPosition();

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="profileSpotlight">
              <Rect x={0} y={0} width={SW} height={SH} fill="white" />
              <AnimatedRect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx={16}
                ry={16}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={SW}
            height={SH}
            fill="rgba(0,0,0,0.8)"
            mask="url(#profileSpotlight)"
          />
        </Svg>
      </Pressable>

      <Animated.View
        style={[
          styles.textContainer,
          textPos,
          {
            opacity: textAnim,
            transform: [
              {
                translateY: textAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [15, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <Text style={styles.tourText}>{STEPS[step].text}</Text>

        <View style={styles.buttonRow}>
          <Pressable onPress={completeTour} hitSlop={12}>
            <Text style={styles.skipText}>Atla</Text>
          </Pressable>

          <Pressable onPress={handleTap} style={styles.nextButton} hitSlop={8}>
            <Text style={styles.nextText}>
              {isLast ? "Anladım!" : "İleri"}
            </Text>
            <Ionicons
              name={isLast ? "checkmark" : "arrow-forward"}
              size={15}
              color={COLORS.white}
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  textContainer: {
    position: "absolute",
    left: 28,
    right: 28,
    alignItems: "center",
  },
  tourText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 25,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  skipText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "500",
  },
  nextButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  nextText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
