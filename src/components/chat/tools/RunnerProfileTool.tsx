import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config"; // Backend URL
import { AuthContext } from "@/utils/authContext"; // Token için
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
export interface RunnerProfileData {
  weight: string;
  height: string;
  gender: "male" | "female";
  pace: string; // "5:30" formatında
  experience: "beginner" | "intermediate" | "advanced";
}

interface RunnerProfileToolProps {
  onSubmit: (data: any) => void;
  submitted?: boolean;
  initialData?: Partial<RunnerProfileData>;
}

// Varsayılan boş veri (Context yüklenmezse diye)
const DEFAULT_DATA: RunnerProfileData = {
  weight: "70",
  height: "175",
  gender: "male",
  pace: "6:00",
  experience: "beginner",
};

// --- HELPER: Pace String to Seconds (5:30 -> 330) ---
const paceToSeconds = (paceStr: string): number => {
  const parts = paceStr.split(":");
  if (parts.length !== 2) return 360; // Hata varsa varsayılan 6:00
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

export const RunnerProfileTool = ({
  onSubmit,
  submitted,
  initialData,
}: RunnerProfileToolProps) => {
  const { getValidToken, refreshUserData } = useContext(AuthContext); // refreshUserData ile app state'i de güncelleriz

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Backend isteği için loading state

  // Form verisi
  const [formData, setFormData] = useState<RunnerProfileData>({
    ...DEFAULT_DATA,
    ...initialData,
  } as RunnerProfileData);

  // --- BACKEND UPDATE LOGIC ---
  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Oturum hatası");

      // 1. Backend'in beklediği formata çevir (String -> Number vb.)
      const payload = {
        weight: parseFloat(formData.weight),
        height: parseInt(formData.height),
        gender: formData.gender, // Backend 'male'/'female' kabul ediyorsa
        experience_level: formData.experience,
        // Backend pace'i saniye cinsinden (Int) bekliyordu:
        current_pace: paceToSeconds(formData.pace),
      };

      // 2. PATCH İsteği At
      const response = await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Profil güncellenemedi.");
      }

      // 3. Başarılıysa Global State'i tazele (HomeScreen vb. güncellensin)
      await refreshUserData();

      // 4. Chatbot'a devam et
      onSubmit({ status: "updated", ...formData });
    } catch (error) {
      Alert.alert(
        "Hata",
        "Profil güncellenirken bir sorun oluştu. Lütfen tekrar dene."
      );
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- VIEW MODE RENDERERS ---
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

  // --- 1. SUBMITTED STATE ---
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

  // --- 2. EDIT MODE ---
  if (isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profili Düzenle</Text>
          <Ionicons name="settings-sharp" size={16} color={COLORS.textDim} />
        </View>

        {/* Cinsiyet Seçimi (Segmented) */}
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

        {/* Boy & Kilo (Yan Yana) */}
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Boy (cm)</Text>
            <TextInput
              style={styles.input}
              value={formData.height}
              onChangeText={(t) => setFormData({ ...formData, height: t })}
              keyboardType="numeric"
              placeholder="175"
              placeholderTextColor="#555"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Kilo (kg)</Text>
            <TextInput
              style={styles.input}
              value={formData.weight}
              onChangeText={(t) => setFormData({ ...formData, weight: t })}
              keyboardType="numeric"
              placeholder="70"
              placeholderTextColor="#555"
            />
          </View>
        </View>

        {/* Pace Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ortalama Pace (dk:sn)</Text>
          <TextInput
            style={styles.input}
            value={formData.pace}
            onChangeText={(t) => setFormData({ ...formData, pace: t })}
            placeholder="05:30"
            placeholderTextColor="#555"
          />
        </View>

        {/* Deneyim Seviyesi */}
        <Text style={styles.inputLabel}>Deneyim</Text>
        <View style={styles.experienceRow}>
          {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[
                styles.expChip,
                formData.experience === lvl && styles.expChipActive,
              ]}
              onPress={() => setFormData({ ...formData, experience: lvl })}
            >
              <Text
                style={[
                  styles.expText,
                  formData.experience === lvl && {
                    color: "#000",
                    fontWeight: "700",
                  },
                ]}
              >
                {lvl === "beginner"
                  ? "Başlangıç"
                  : lvl === "intermediate"
                  ? "Orta"
                  : "İleri"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Aksiyonlar */}
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
      </View>
    );
  }

  // --- 3. VIEW MODE (Default - ID Card Style) ---
  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>
        Senin için bu profil verilerini kullanıyorum:
      </Text>

      {/* ID CARD TASARIMI */}
      <View style={styles.idCard}>
        {/* Üst Satır: Profil Özeti */}
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

        {/* Grid Veriler */}
        <View style={styles.gridContainer}>
          {renderInfoBadge(
            "speedometer-outline",
            "Pace",
            `${formData.pace}/km`
          )}
          {renderInfoBadge(
            "cellular-outline",
            "Seviye",
            formData.experience === "beginner"
              ? "Başlangıç"
              : formData.experience === "intermediate"
              ? "Orta"
              : "İleri"
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

// --- STYLES ---
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

  // ID Card Styles
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

  // Inputs
  inputGroup: { marginBottom: 12 },
  rowInputs: { flexDirection: "row", marginBottom: 12 },
  inputLabel: { color: "#888", fontSize: 12, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: "#2C2C2C",
    color: "white",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#444",
  },

  // Segmented Control (Gender)
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

  // Experience Chips
  experienceRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  expChip: {
    flex: 1,
    backgroundColor: "#2C2C2C",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
  },
  expChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  expText: { color: "#AAA", fontSize: 11, fontWeight: "600" },

  // Buttons
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

  // Submitted
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
});
