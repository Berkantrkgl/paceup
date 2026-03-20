import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// --- HELPERS ---
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

// --- TYPES ---
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
                  color={isBeginner ? COLORS.accent : "#666"}
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
                  style={styles.pickerStyleHalf}
                  itemStyle={styles.pickerItemStyle}
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
                  style={styles.pickerStyleHalf}
                  itemStyle={styles.pickerItemStyle}
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
          itemStyle={styles.pickerItemStyle}
          dropdownIconColor="white"
          style={styles.pickerStyleFull}
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
          <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
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
                color={COLORS.accent}
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
                color={formData.gender === "male" ? "#000" : "#666"}
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
                color={formData.gender === "female" ? "#000" : "#666"}
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
              <Ionicons name="resize-outline" size={24} color={COLORS.accent} />
            </View>
            <View>
              <Text style={styles.profileLabel}>Boy</Text>
              <Text style={styles.profileValue}>{formData.height} cm</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
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
                color={COLORS.accent}
              />
            </View>
            <View>
              <Text style={styles.profileLabel}>Kilo</Text>
              <Text style={styles.profileValue}>{formData.weight} kg</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
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
                color={COLORS.accent}
              />
            </View>
            <View>
              <Text style={styles.profileLabel}>Ortalama Pace</Text>
              <Text style={styles.profileValue}>{displayPace()}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </Pressable>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={handleSaveAndContinue}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <>
            <Text style={styles.btnText}>Onayla ve Devam Et</Text>
            <Ionicons name="arrow-forward" size={20} color="#000" />
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#999",
    marginBottom: 16,
  },

  // Profil Listesi
  profileList: {
    gap: 8,
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#252525",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  profileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1F1F1F",
    justifyContent: "center",
    alignItems: "center",
  },
  profileLabel: {
    fontSize: 11,
    color: "#777",
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },

  // Cinsiyet Toggle
  genderToggle: {
    flexDirection: "row",
    backgroundColor: "#1F1F1F",
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  genderBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  genderBtnActive: {
    backgroundColor: COLORS.accent,
  },

  // Button
  btn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },

  // Submitted
  submittedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  submittedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  submittedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  submittedSubtitle: {
    fontSize: 12,
    color: "#999",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalKeyboardAvoiding: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCenteredContainer: { width: "90%", maxWidth: 400 },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#242426",
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.white },
  headerBtn: { padding: 5 },
  headerBtnTextCancel: { color: COLORS.textDim, fontSize: 15 },
  headerBtnTextSave: { color: COLORS.accent, fontSize: 15, fontWeight: "bold" },
  modalBody: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#1C1C1E",
    minHeight: 150,
    justifyContent: "center",
  },

  pickerWrapper: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  pickerStyleFull: { color: "white", width: "100%" },
  pickerItemStyle: { color: "white", fontSize: 22, textAlign: "center" },
  dualPickerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  pickerColumn: { flex: 1, alignItems: "center" },
  pickerStyleHalf: { color: "white", width: "100%" },
  columnLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: -10,
    zIndex: 1,
  },
  pickerSeparator: {
    fontSize: 30,
    color: "white",
    paddingBottom: 20,
    paddingHorizontal: 10,
  },

  beginnerToggleContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  beginnerToggle: {
    backgroundColor: "#252525",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  beginnerToggleActive: {
    backgroundColor: COLORS.accent + "15",
    borderColor: COLORS.accent,
  },
  beginnerToggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beginnerToggleTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  beginnerToggleSubtitle: {
    color: COLORS.textDim,
    fontSize: 12,
  },
});
