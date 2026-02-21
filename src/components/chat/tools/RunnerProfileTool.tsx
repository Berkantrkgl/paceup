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

// --- YARDIMCI FONKSİYONLAR & SABİTLER ---
const generateNumberRange = (start: number, end: number, suffix: string) => {
  const options = [];
  for (let i = start; i <= end; i++) {
    // Suffix'i (cm, kg) Picker içinde gösteriyoruz
    options.push({ label: `${i} ${suffix}`, value: String(i) });
  }
  return options;
};

const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3);
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i);

const paceToSeconds = (paceStr: string): number => {
  const parts = paceStr.split(":");
  if (parts.length !== 2) return 360;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

// --- TYPES ---
export interface RunnerProfileData {
  weight: string;
  height: string;
  gender: "male" | "female";
  pace: string; // "05:30" formatında
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<RunnerProfileData>({
    ...DEFAULT_DATA,
    ...initialData,
  } as RunnerProfileData);

  // --- MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [editConfig, setEditConfig] = useState<any>({
    key: "",
    title: "",
    type: "picker",
    options: [],
  });

  // Geçici Modal Verileri
  const [tempValue, setTempValue] = useState<string>("");
  const [tempPace, setTempPace] = useState({ min: 6, sec: 0 });

  // --- MODAL YÖNETİMİ ---
  const openEditor = (
    key: keyof RunnerProfileData,
    title: string,
    type: "picker" | "pace",
    options: any[] = [],
  ) => {
    setEditConfig({ key, title, type, options });
    if (type === "pace") {
      const [m, s] = formData.pace.split(":").map(Number);
      setTempPace({ min: m || 6, sec: s || 0 });
    } else {
      setTempValue(formData[key]);
    }
    setModalVisible(true);
  };

  const saveModalChange = () => {
    if (editConfig.type === "pace") {
      const mStr = tempPace.min.toString().padStart(2, "0");
      const sStr = tempPace.sec.toString().padStart(2, "0");
      setFormData({ ...formData, pace: `${mStr}:${sStr}` });
    } else {
      setFormData({ ...formData, [editConfig.key]: tempValue });
    }
    setModalVisible(false);
  };

  // --- BACKEND UPDATE LOGIC ---
  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Oturum hatası");

      const payload = {
        weight: parseFloat(formData.weight) || 0,
        height: parseInt(formData.height) || 0,
        gender: formData.gender,
        current_pace: paceToSeconds(formData.pace),
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
      onSubmit({ status: "updated", ...formData });
    } catch (error) {
      Alert.alert("Hata", "Profil güncellenirken bir sorun oluştu.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderInfoBadge = (icon: any, label: string, value: string) => (
    <View style={styles.infoBadge}>
      <View style={styles.badgeIconBox}>
        <Ionicons name={icon} size={14} color={COLORS.accent} />
      </View>
      <View>
        <Text style={styles.badgeLabel}>{label}</Text>
        <Text style={styles.badgeValue}>{value}</Text>
      </View>
    </View>
  );

  // --- MODAL İÇERİĞİ ---
  const renderModalContent = () => {
    if (editConfig.type === "pace") {
      return (
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

  if (submitted) {
    return (
      <View style={styles.submittedContainer}>
        <View style={styles.submittedIcon}>
          <Ionicons name="checkmark" size={16} color={COLORS.background} />
        </View>
        <Text style={styles.submittedText}>Profil bilgileri alındı.</Text>
      </View>
    );
  }

  if (isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profili Düzenle</Text>
          <Ionicons name="settings-sharp" size={16} color={COLORS.textDim} />
        </View>

        {/* Cinsiyet Seçimi */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              formData.gender === "male" && styles.segmentBtnActive,
            ]}
            onPress={() => setFormData({ ...formData, gender: "male" })}
          >
            <Ionicons
              name="man"
              size={16}
              color={formData.gender === "male" ? "#000" : "#666"}
            />
            <Text
              style={[
                styles.segmentText,
                formData.gender === "male" && styles.segmentTextActive,
              ]}
            >
              Erkek
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              formData.gender === "female" && styles.segmentBtnActive,
            ]}
            onPress={() => setFormData({ ...formData, gender: "female" })}
          >
            <Ionicons
              name="woman"
              size={16}
              color={formData.gender === "female" ? "#000" : "#666"}
            />
            <Text
              style={[
                styles.segmentText,
                formData.gender === "female" && styles.segmentTextActive,
              ]}
            >
              Kadın
            </Text>
          </TouchableOpacity>
        </View>

        {/* Boy & Kilo Row (YENİ KART TASARIMI) */}
        <View style={styles.rowInputs}>
          <Pressable
            style={styles.pickerTriggerCard}
            onPress={() =>
              openEditor(
                "height",
                "Boy Seçimi",
                "picker",
                generateNumberRange(140, 230, "cm"),
              )
            }
          >
            <Text style={styles.inputLabelCenter}>Boy</Text>
            <Text style={styles.pickerTriggerText}>
              {formData.height} <Text style={styles.unitText}>cm</Text>
            </Text>
          </Pressable>
          <View style={{ width: 12 }} />
          <Pressable
            style={styles.pickerTriggerCard}
            onPress={() =>
              openEditor(
                "weight",
                "Kilo Seçimi",
                "picker",
                generateNumberRange(40, 160, "kg"),
              )
            }
          >
            <Text style={styles.inputLabelCenter}>Kilo</Text>
            <Text style={styles.pickerTriggerText}>
              {formData.weight} <Text style={styles.unitText}>kg</Text>
            </Text>
          </Pressable>
        </View>

        {/* Pace Input (YENİ KART TASARIMI) */}
        <View style={styles.inputGroup}>
          <Pressable
            style={styles.pickerTriggerCard}
            onPress={() => openEditor("pace", "Ortalama Pace Seçimi", "pace")}
          >
            <Text style={styles.inputLabelCenter}>Ortalama Pace</Text>
            <Text style={styles.pickerTriggerText}>
              {formData.pace} <Text style={styles.unitText}>/km</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => setIsEditing(false)}
            disabled={isSaving}
          >
            <Text style={styles.btnGhostText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleSaveAndContinue}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.btnText}>Kaydet ve Devam Et</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* CENTERED MODAL */}
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
                    <Pressable
                      onPress={saveModalChange}
                      style={styles.headerBtn}
                    >
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
  }

  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>
        Senin için bu profil verilerini kullanıyorum:
      </Text>
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <View style={styles.avatarCircle}>
            <Ionicons
              name={formData.gender === "female" ? "woman" : "man"}
              size={24}
              color={COLORS.card}
            />
          </View>
          <View>
            <Text style={styles.idTitle}>Sporcu Profili</Text>
            <Text style={styles.idSubtitle}>
              {formData.height} cm • {formData.weight} kg
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.gridContainer}>
          {renderInfoBadge(
            "speedometer-outline",
            "Pace",
            `${formData.pace}/km`,
          )}
          {renderInfoBadge(
            "person-outline",
            "Cinsiyet",
            formData.gender === "male" ? "Erkek" : "Kadın",
          )}
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => setIsEditing(true)}
        >
          <Text style={styles.btnTextSecondary}>Düzenle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => onSubmit({ status: "confirmed", ...formData })}
        >
          <Text style={styles.btnText}>Onayla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%" },
  title: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  questionText: { color: "#DDD", marginBottom: 12, fontSize: 14 },

  idCard: {
    backgroundColor: "#252525",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  idHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  idTitle: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  idSubtitle: { color: COLORS.white, fontSize: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#333", marginBottom: 12 },
  gridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  infoBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#303030",
    padding: 8,
    borderRadius: 10,
  },
  badgeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeLabel: { color: "#888", fontSize: 10, fontWeight: "600" },
  badgeValue: { color: "#EEE", fontSize: 13, fontWeight: "700" },

  inputGroup: { marginBottom: 20 },
  rowInputs: { flexDirection: "row", marginBottom: 12 },

  // --- YENİ KART TASARIMI ---
  pickerTriggerCard: {
    flex: 1,
    backgroundColor: "#252525", // Biraz daha açık, karta benzeyen renk
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTriggerText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 6,
  },
  unitText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  inputLabelCenter: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentBtnActive: { backgroundColor: COLORS.accent },
  segmentText: { color: "#888", fontSize: 13, fontWeight: "600" },
  segmentTextActive: { color: "#000", fontWeight: "700" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnSecondary: {
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#444",
  },
  btnGhost: {
    paddingHorizontal: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  btnTextSecondary: { color: "white", fontSize: 13, fontWeight: "600" },
  btnGhostText: { color: "#888", fontSize: 13 },

  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.success + "40",
  },
  submittedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
  },
  submittedText: { color: "#CCC", fontSize: 13, fontWeight: "500" },

  // --- MODAL STYLES ---
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

  // YAZILARI ORTALAYAN STİL BURADA:
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
});
