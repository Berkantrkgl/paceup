import { API_URL } from "@/constants/Config";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const generateNumberRange = (start: number, end: number, suffix: string) => {
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push({ label: `${i} ${suffix}`, value: String(i) });
  }
  return options;
};

const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3);
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i);

const paceToSeconds = (paceStr: string): number => {
  if (paceStr === "beginner") return 0;
  const parts = paceStr.split(":");
  if (parts.length !== 2) return 360;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

export interface RunnerProfileData {
  weight: string;
  height: string;
  gender: "male" | "female";
  pace: string;
}

interface RunnerProfileToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
  initialData?: Partial<RunnerProfileData>;
}

const DEFAULT_DATA: RunnerProfileData = {
  weight: "70",
  height: "175",
  gender: "male",
  pace: "06:00",
};

export const RunnerProfileTool = ({
  onSubmit,
  submitted,
  initialData,
}: RunnerProfileToolProps) => {
  const { getValidToken, refreshUserData } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pickerTextColor = colors.text.primary;

  const [formData, setFormData] = useState<RunnerProfileData>({
    ...DEFAULT_DATA,
    ...initialData,
  } as RunnerProfileData);

  const [isBeginner, setIsBeginner] = useState(
    initialData?.pace === "beginner" || !initialData?.pace,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editConfig, setEditConfig] = useState<any>({
    key: "",
    title: "",
    type: "picker",
    options: [],
  });

  const [tempValue, setTempValue] = useState<string>("");
  const [tempPace, setTempPace] = useState({ min: 6, sec: 0 });

  const openEditor = (
    key: keyof RunnerProfileData,
    title: string,
    type: "picker" | "pace",
    options: any[] = [],
  ) => {
    setEditConfig({ key, title, type, options });
    if (type === "pace") {
      if (!isBeginner && formData.pace !== "beginner") {
        const [m, s] = formData.pace.split(":").map(Number);
        setTempPace({ min: m || 6, sec: s || 0 });
      } else {
        setTempPace({ min: 6, sec: 0 });
      }
    } else {
      setTempValue(formData[key]);
    }
    setModalVisible(true);
  };

  const saveModalChange = () => {
    if (editConfig.type === "pace") {
      if (isBeginner) {
        setFormData({ ...formData, pace: "beginner" });
      } else {
        const mStr = tempPace.min.toString().padStart(2, "0");
        const sStr = tempPace.sec.toString().padStart(2, "0");
        setFormData({ ...formData, pace: `${mStr}:${sStr}` });
      }
    } else {
      setFormData({ ...formData, [editConfig.key]: tempValue });
    }
    setModalVisible(false);
  };

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Oturum hatası");

      const payload = {
        weight: parseFloat(formData.weight) || 0,
        height: parseInt(formData.height) || 0,
        gender: formData.gender,
        current_pace: isBeginner ? 0 : paceToSeconds(formData.pace),
      };

      const response = await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Profil güncellenemedi.");

      await refreshUserData();
      onSubmit({
        status: "updated",
        ...formData,
        is_beginner: isBeginner,
      });
    } catch (error) {
      Alert.alert("Hata", "Profil güncellenirken bir sorun oluştu.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderModalContent = () => {
    if (editConfig.type === "pace") {
      return (
        <View>
          <View style={styles.beginnerToggleContainer}>
            <Pressable
              style={[
                styles.beginnerToggle,
                isBeginner && styles.beginnerToggleActive,
              ]}
              onPress={() => setIsBeginner(!isBeginner)}
            >
              <View style={styles.beginnerToggleContent}>
                <Ionicons
                  name={isBeginner ? "checkmark-circle" : "radio-button-off"}
                  size={22}
                  color={isBeginner ? colors.accent : colors.text.secondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.beginnerToggleTitle}>
                    🏃‍♂️ Koşuya Yeni Başlıyorum
                  </Text>
                  <Text style={styles.beginnerToggleSubtitle}>
                    Pace'imi bilmiyorum, acemi seviyesindeyim
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {!isBeginner && (
            <View style={styles.dualPickerContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Dakika</Text>
                <Picker
                  selectedValue={tempPace.min}
                  onValueChange={(v) => setTempPace({ ...tempPace, min: v })}
                  style={{ color: pickerTextColor, width: "100%" }}
                  itemStyle={{
                    color: pickerTextColor,
                    fontSize: 22,
                    textAlign: "center",
                  }}
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
                  selectedValue={tempPace.sec}
                  onValueChange={(v) => setTempPace({ ...tempPace, sec: v })}
                  style={{ color: pickerTextColor, width: "100%" }}
                  itemStyle={{
                    color: pickerTextColor,
                    fontSize: 22,
                    textAlign: "center",
                  }}
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
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={tempValue}
          onValueChange={(itemValue) => setTempValue(itemValue)}
          itemStyle={{
            color: pickerTextColor,
            fontSize: 22,
            textAlign: "center",
          }}
          dropdownIconColor={pickerTextColor}
          style={{ color: pickerTextColor, width: "100%" }}
        >
          {editConfig.options.map((opt: any) => (
            <Picker.Item
              key={opt.value}
              label={opt.label.toString()}
              value={opt.value}
            />
          ))}
        </Picker>
      </View>
    );
  };

  const displayPace = () => {
    if (isBeginner || formData.pace === "beginner") return "Acemi";
    return `${formData.pace}/km`;
  };

  if (submitted) {
    return (
      <View style={styles.submittedCard}>
        <View style={styles.submittedIcon}>
          <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedTitle}>Profil Onaylandı</Text>
          <Text style={styles.submittedSubtitle}>
            {formData.height}cm • {formData.weight}kg • {displayPace()}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Koşucu Profili</Text>
      <Text style={styles.subtitle}>Bu bilgileri senin için kullanacağım</Text>

      {/* Liste Tarzı Profil Kartları */}
      <View style={styles.profileList}>
        {/* Cinsiyet */}
        <View style={styles.profileRow}>
          <View style={styles.profileLeft}>
            <View style={styles.profileIconBox}>
              <Ionicons
                name={formData.gender === "female" ? "woman" : "man"}
                size={20}
                color={colors.accent}
              />
            </View>
            <View>
              <Text style={styles.profileLabel}>Cinsiyet</Text>
              <Text style={styles.profileValue}>
                {formData.gender === "male" ? "Erkek" : "Kadın"}
              </Text>
            </View>
          </View>
          <View style={styles.genderToggle}>
            <TouchableOpacity
              style={[
                styles.genderBtn,
                formData.gender === "male" && styles.genderBtnActive,
              ]}
              onPress={() => setFormData({ ...formData, gender: "male" })}
            >
              <Ionicons
                name="man"
                size={18}
                color={
                  formData.gender === "male"
                    ? colors.text.inverse
                    : colors.text.secondary
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderBtn,
                formData.gender === "female" && styles.genderBtnActive,
              ]}
              onPress={() => setFormData({ ...formData, gender: "female" })}
            >
              <Ionicons
                name="woman"
                size={18}
                color={
                  formData.gender === "female"
                    ? colors.text.inverse
                    : colors.text.secondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Boy */}
        <Pressable
          style={styles.profileRow}
          onPress={() =>
            openEditor(
              "height",
              "Boy Seçimi",
              "picker",
              generateNumberRange(140, 230, "cm"),
            )
          }
        >
          <View style={styles.profileLeft}>
            <View style={styles.profileIconBox}>
              <Ionicons name="resize-outline" size={24} color={colors.accent} />
            </View>
            <View>
              <Text style={styles.profileLabel}>Boy</Text>
              <Text style={styles.profileValue}>{formData.height} cm</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </Pressable>

        {/* Kilo */}
        <Pressable
          style={styles.profileRow}
          onPress={() =>
            openEditor(
              "weight",
              "Kilo Seçimi",
              "picker",
              generateNumberRange(40, 160, "kg"),
            )
          }
        >
          <View style={styles.profileLeft}>
            <View style={styles.profileIconBox}>
              <Ionicons
                name="fitness-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <View>
              <Text style={styles.profileLabel}>Kilo</Text>
              <Text style={styles.profileValue}>{formData.weight} kg</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </Pressable>

        {/* Pace */}
        <Pressable
          style={styles.profileRow}
          onPress={() => openEditor("pace", "Pace Seçimi", "pace")}
        >
          <View style={styles.profileLeft}>
            <View style={styles.profileIconBox}>
              <Ionicons
                name="speedometer-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <View>
              <Text style={styles.profileLabel}>Ortalama Pace</Text>
              <Text style={styles.profileValue}>{displayPace()}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={handleSaveAndContinue}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <>
            <Text style={styles.btnText}>Onayla ve Devam Et</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.text.inverse} />
          </>
        )}
      </TouchableOpacity>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardAvoiding}
          >
            <Pressable
              style={styles.modalCenteredContainer}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Pressable
                    onPress={() => setModalVisible(false)}
                    style={styles.headerBtn}
                  >
                    <Text style={styles.headerBtnTextCancel}>Vazgeç</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>{editConfig.title}</Text>
                  <Pressable onPress={saveModalChange} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTextSave}>Kaydet</Text>
                  </Pressable>
                </View>
                <View style={styles.modalBody}>{renderModalContent()}</View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: {
      width: "100%" as const,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
    },
    title: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: c.text.secondary,
      marginBottom: 16,
    },

    // Profil Listesi
    profileList: {
      gap: 8,
      marginBottom: 14,
    },
    profileRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: c.surfaceVariant,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    profileLeft: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    profileIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.surface,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    profileLabel: {
      fontSize: 11,
      color: c.text.secondary,
      marginBottom: 2,
    },
    profileValue: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: c.text.primary,
    },

    // Cinsiyet Toggle
    genderToggle: {
      flexDirection: "row" as const,
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 2,
      gap: 2,
    },
    genderBtn: {
      width: 34,
      height: 34,
      borderRadius: 7,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    genderBtnActive: {
      backgroundColor: c.accent,
    },

    // Button
    btn: {
      backgroundColor: c.accent,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    btnText: {
      color: c.text.inverse,
      fontWeight: "700" as const,
      fontSize: 14,
    },

    // Submitted
    submittedCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surfaceVariant,
      padding: 12,
      borderRadius: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    submittedIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accent + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    submittedTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 2,
    },
    submittedSubtitle: {
      fontSize: 12,
      color: c.text.secondary,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    modalKeyboardAvoiding: {
      width: "100%" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    modalCenteredContainer: { width: "90%" as const, maxWidth: 400 },
    modalContent: {
      backgroundColor: c.surface,
      borderRadius: 20,
      overflow: "hidden" as const,
    },
    modalHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surfaceVariant,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: c.text.primary,
    },
    headerBtn: { padding: 5 },
    headerBtnTextCancel: { color: c.text.secondary, fontSize: 15 },
    headerBtnTextSave: {
      color: c.accent,
      fontSize: 15,
      fontWeight: "bold" as const,
    },
    modalBody: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: c.surface,
      minHeight: 150,
      justifyContent: "center" as const,
    },

    pickerWrapper: {
      justifyContent: "center" as const,
      alignItems: "center" as const,
      width: "100%" as const,
    },
    dualPickerContainer: {
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      width: "100%" as const,
      paddingHorizontal: 20,
    },
    pickerColumn: { flex: 1, alignItems: "center" as const },
    columnLabel: {
      color: c.text.secondary,
      fontSize: 12,
      marginBottom: -10,
      zIndex: 1,
    },
    pickerSeparator: {
      fontSize: 30,
      color: c.text.primary,
      paddingBottom: 20,
      paddingHorizontal: 10,
    },

    beginnerToggleContainer: {
      paddingHorizontal: 15,
      paddingBottom: 15,
    },
    beginnerToggle: {
      backgroundColor: c.surfaceVariant,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    beginnerToggleActive: {
      backgroundColor: c.accent + "15",
      borderColor: c.accent,
    },
    beginnerToggleContent: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
    },
    beginnerToggleTitle: {
      color: c.text.primary,
      fontSize: 14,
      fontWeight: "600" as const,
      marginBottom: 2,
    },
    beginnerToggleSubtitle: {
      color: c.text.secondary,
      fontSize: 12,
    },
  } as const;
};
